"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";

// ─── Tipi per i dati live ───

export interface LivePosition {
  driver_number: number;
  position: number;
  date: string;
}

export interface LiveRaceControl {
  message: string;
  flag?: string;
  driver_number?: number;
  date: string;
  category?: string;
}

export interface LiveLap {
  driver_number: number;
  lap_duration: number | null;
  lap_number: number;
  date: string;
}

export interface LiveStint {
  driver_number: number;
  compound: string;
  tyre_age_at_start?: number;
  date: string;
}

const STALE_DATA_MS = 15000;   // se per 15s non arrivano dati live → considera la WS "ferma"
const SAFETY_CHECK_MS = 7000;  // ogni 7s controlla la freschezza e, se ferma, fa un poll REST

/**
 * Hook WebSocket MQTT per dati live OpenF1.
 *
 * Strategia di resilienza:
 *   1. Fetch iniziale via /api/live-data (no CORS)
 *   2. Connessione MQTT push real-time (path felice)
 *   3. Watchdog: se MQTT non si connette entro 8s OR si disconnette,
 *      attiva polling REST /api/live-data ogni 15s come fallback.
 *      Il polling si ferma automaticamente quando MQTT torna su.
 *
 * Espone `mode` per debug: "mqtt" se MQTT attivo, "polling" se in fallback,
 * "init" durante il primo fetch.
 */
export function useLiveWebSocket(sessionKey: number | null) {
  const [positions, setPositions] = useState<Map<number, LivePosition>>(new Map());
  const [raceControl, setRaceControl] = useState<LiveRaceControl[]>([]);
  const [fastestLap, setFastestLap] = useState<{ driver_number: number; duration: number } | null>(null);
  const [stints, setStints] = useState<LiveStint[]>([]);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"init" | "mqtt" | "polling">("init");
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const fastestRef = useRef<number>(Infinity);
  // Timestamp dell'ultimo dato live applicato (MQTT o REST). Serve al "safety check":
  // se i dati sono fermi da troppo tempo, riattiviamo il polling REST anche se la
  // connessione MQTT risulta "aperta" ma silenziosa.
  const lastDataAtRef = useRef<number>(0);

  // Reset quando cambia sessione. Reset intenzionale e poco frequente (solo al
  // cambio di sessionKey): azzeriamo lo stato live per non mostrare dati della
  // sessione precedente.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPositions(new Map());
    setRaceControl([]);
    setFastestLap(null);
    setStints([]);
    fastestRef.current = Infinity;
    lastDataAtRef.current = 0;
    setMode("init");
  }, [sessionKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Applica una risposta /api/live-data (sia per init che per polling)
  const applyLiveSnapshot = useCallback((data: {
    positions?: LivePosition[];
    raceControl?: LiveRaceControl[];
    laps?: LiveLap[];
    stints?: LiveStint[];
  }) => {
    if (data.positions?.length || data.raceControl?.length || data.laps?.length || data.stints?.length) {
      lastDataAtRef.current = Date.now();
    }
    if (data.positions?.length) {
      const posMap = new Map<number, LivePosition>();
      for (const p of data.positions) {
        if (!p.driver_number || !p.position) continue;
        const existing = posMap.get(p.driver_number);
        if (!existing || p.date > existing.date) posMap.set(p.driver_number, p);
      }
      setPositions(posMap);
    }
    if (data.raceControl?.length) setRaceControl(data.raceControl);
    if (data.laps?.length) {
      let fastest = Infinity;
      let fastestDriver = 0;
      for (const l of data.laps) {
        if (l.lap_duration && l.lap_duration > 0 && l.lap_duration < fastest) {
          fastest = l.lap_duration;
          fastestDriver = l.driver_number;
        }
      }
      if (fastestDriver) {
        fastestRef.current = fastest;
        setFastestLap({ driver_number: fastestDriver, duration: fastest });
      }
    }
    if (data.stints?.length) setStints(data.stints);
  }, []);

  const fetchLiveData = useCallback(async (sk: number, signal: AbortSignal) => {
    try {
      const res = await fetch(`/api/live-data?session_key=${sk}`, { cache: "no-store", signal });
      if (!res.ok) {
        console.warn("[live-ws] /api/live-data response not ok", res.status);
        return;
      }
      const data = await res.json();
      applyLiveSnapshot(data);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.warn("[live-ws] fetchLiveData failed", err);
    }
  }, [applyLiveSnapshot]);

  useEffect(() => {
    if (!sessionKey) return;

    let client: mqtt.MqttClient | null = null;
    const abortCtrl = new AbortController();
    let cancelled = false;

    // Safety-net: gira sempre finché la sessione è attiva. Se i dati live sono
    // fermi da più di STALE_DATA_MS — perché MQTT non si connette OPPURE è
    // connesso ma silenzioso — fa un poll REST. Quando i dati live riprendono
    // ad arrivare (lastDataAtRef si aggiorna) smette da solo. Questo evita il
    // caso "live a zero" in cui la WS sembra aperta ma non spinge nulla.
    const safetyTimer: ReturnType<typeof setInterval> = setInterval(() => {
      if (cancelled) return;
      if (Date.now() - lastDataAtRef.current > STALE_DATA_MS) {
        setMode("polling");
        fetchLiveData(sessionKey!, abortCtrl.signal);
      }
    }, SAFETY_CHECK_MS);

    async function connect() {
      try {
        // Fetch dati iniziali via proxy (abortabile se sessionKey cambia)
        await fetchLiveData(sessionKey!, abortCtrl.signal);
        if (cancelled) return;

        // Ottieni token per WebSocket
        const tokenRes = await fetch("/api/openf1-token", { signal: abortCtrl.signal });
        if (!tokenRes.ok) {
          console.warn("[live-ws] /api/openf1-token response not ok", tokenRes.status);
          return; // niente token: ci pensa il safety-net col polling REST
        }
        const { access_token } = await tokenRes.json();
        if (!access_token) {
          console.warn("[live-ws] empty access_token, MQTT will not connect");
          return; // niente token: ci pensa il safety-net col polling REST
        }
        if (cancelled) return;

        // Connetti MQTT over WebSocket
        client = mqtt.connect("wss://mqtt.openf1.org:8084/mqtt", {
          username: access_token,
          password: "",
          protocolVersion: 5,
          reconnectPeriod: 5000,
        });

        clientRef.current = client;

        client.on("connect", () => {
          setConnected(true);
          // Non passiamo subito a "mqtt": il mode diventa "mqtt" solo al PRIMO
          // messaggio reale (vedi handler sotto). Così, se la connessione si apre
          // ma resta silenziosa, il safety-net continua col polling e l'utente
          // non resta bloccato a 0.
          client!.subscribe([
            "v1/position",
            "v1/race_control",
            "v1/laps",
            "v1/stints",
          ]);
        });

        // Polling e riconnessione sono gestiti dal safety-net + reconnectPeriod:
        // qui aggiorniamo solo lo stato di connessione per la UI.
        client.on("close", () => setConnected(false));
        client.on("offline", () => setConnected(false));
        client.on("error", (err) => {
          console.warn("[live-ws] mqtt error", err?.message ?? err);
        });

        // Telemetria: contiamo messaggi per session_key. Se vediamo molti
        // messaggi con session_key ≠ quello atteso, sappiamo che useLiveSession
        // ha rilevato la sessione sbagliata.
        const seenSessionKeys = new Map<number, number>();
        let lastLogAt = 0;

        client.on("message", (_topic: string, payload: Buffer) => {
          try {
            const msg = JSON.parse(payload.toString());

            // Debug telemetry: traccia le session_key che arrivano vs attesa
            if (msg.session_key) {
              seenSessionKeys.set(msg.session_key, (seenSessionKeys.get(msg.session_key) ?? 0) + 1);
              const now = Date.now();
              if (now - lastLogAt > 30_000) {
                lastLogAt = now;
                const stats = Array.from(seenSessionKeys.entries())
                  .map(([k, v]) => `${k}:${v}${k === sessionKey ? "✓" : "✗"}`)
                  .join(" ");
                console.log(`[live-ws] expected sessionKey=${sessionKey} · received: ${stats}`);
              }
            }

            if (msg.session_key && msg.session_key !== sessionKey) return;

            // Dato valido della nostra sessione: aggiorna la freschezza (così il
            // safety-net non fa polling inutile) e segna la modalità "mqtt" push.
            lastDataAtRef.current = Date.now();
            setMode("mqtt");

            const topic = _topic.replace(/^\//, "");

            if (topic === "v1/position" && msg.driver_number && msg.position) {
              setPositions((prev) => {
                const next = new Map(prev);
                const existing = next.get(msg.driver_number);
                if (!existing || msg.date > existing.date) {
                  next.set(msg.driver_number, {
                    driver_number: msg.driver_number,
                    position: msg.position,
                    date: msg.date,
                  });
                }
                return next;
              });
            }

            if (topic === "v1/race_control" && msg.message) {
              setRaceControl((prev) => [...prev, {
                message: msg.message,
                flag: msg.flag,
                driver_number: msg.driver_number,
                date: msg.date || new Date().toISOString(),
                category: msg.category,
              }]);
            }

            if (topic === "v1/laps" && msg.lap_duration && msg.lap_duration > 0) {
              if (msg.lap_duration < fastestRef.current) {
                fastestRef.current = msg.lap_duration;
                setFastestLap({
                  driver_number: msg.driver_number,
                  duration: msg.lap_duration,
                });
              }
            }

            if (topic === "v1/stints" && msg.compound) {
              setStints((prev) => [...prev, {
                driver_number: msg.driver_number,
                compound: msg.compound,
                tyre_age_at_start: msg.tyre_age_at_start,
                date: msg.date || new Date().toISOString(),
              }]);
            }
          } catch (err) {
            console.warn("[live-ws] failed to parse mqtt message", err);
          }
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // connect() fallito: ci pensa il safety-net a fare polling REST.
        console.warn("[live-ws] connect() failed, REST safety-net will poll", err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortCtrl.abort();
      clearInterval(safetyTimer);
      if (client) {
        client.end(true);
        clientRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionKey, fetchLiveData]);

  return { positions, raceControl, fastestLap, stints, connected, mode };
}
