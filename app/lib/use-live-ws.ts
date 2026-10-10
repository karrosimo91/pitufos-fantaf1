"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import { mergePositions, latestPositionDate, type LivePositionEntry } from "./live-positions";

// ─── Tipi per i dati live ───

export type LivePosition = LivePositionEntry;

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

const STALE_DATA_MS = 15000;      // nessun dato di nessun tipo per 15 s → la WS è "ferma", polling REST
const STALE_POSITIONS_MS = 30000; // posizioni ferme per 30 s → riallineamento REST, anche se il resto arriva
const SAFETY_CHECK_MS = 7000;     // ogni 7 s controlla la freschezza
const RESYNC_MIN_GAP_MS = 20000;  // non più di un riallineamento REST ogni 20 s
const TELEMETRY_EVERY_MS = 30000;

type Topic = "position" | "race_control" | "laps" | "stints";
const TOPICS: Topic[] = ["position", "race_control", "laps", "stints"];

/**
 * Hook WebSocket MQTT per dati live OpenF1.
 *
 * Strategia di resilienza:
 *   1. Fetch iniziale via /api/live-data (no CORS)
 *   2. Connessione MQTT push real-time (path felice)
 *   3. Safety-net: se non arriva NESSUN dato per 15 s (MQTT non connesso o
 *      silenzioso) fa polling REST di /api/live-data.
 *   4. Riallineamento delle POSIZIONI: il punteggio dipende solo da
 *      `v1/position`, che emette un messaggio soltanto quando una macchina
 *      cambia posizione. Race control, giri e stint continuano ad arrivare
 *      anche quando le posizioni sono ferme, quindi "arrivano dati" non vuol
 *      dire "la classifica è aggiornata": se le posizioni non si muovono da
 *      30 s, alla riconnessione MQTT (iOS sospende la WS quando l'app va in
 *      background: i cambi di posizione persi non vengono mai rimandati) e
 *      quando la pagina torna in primo piano, si chiede a REST solo il
 *      seguito (`since` = ultima posizione nota) e si fonde.
 *
 * Espone `mode` per debug: "mqtt" se MQTT attivo, "polling" se in fallback,
 * "init" durante il primo fetch; `lastPositionAt` è l'ultimo istante in cui
 * le posizioni sono state ricevute o verificate.
 */
export function useLiveWebSocket(sessionKey: number | null) {
  const [positions, setPositions] = useState<Map<number, LivePosition>>(new Map());
  const [raceControl, setRaceControl] = useState<LiveRaceControl[]>([]);
  const [fastestLap, setFastestLap] = useState<{ driver_number: number; duration: number } | null>(null);
  const [stints, setStints] = useState<LiveStint[]>([]);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"init" | "mqtt" | "polling">("init");
  // Giro corrente (massimo lap_number visto) e istante dell'ultimo dato
  // applicato: servono alla barra di sessione (GIRO 23 · aggiornato 3 s fa).
  const [currentLap, setCurrentLap] = useState<number | null>(null);
  const [lastDataAt, setLastDataAt] = useState<number>(0);
  // Ultimo istante in cui le posizioni sono arrivate (MQTT) o sono state
  // verificate (REST, anche senza novità): è la freschezza della classifica.
  const [lastPositionAt, setLastPositionAt] = useState<number>(0);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const fastestRef = useRef<number>(Infinity);
  // Timestamp dell'ultimo dato live applicato (MQTT o REST). Serve al "safety check":
  // se i dati sono fermi da troppo tempo, riattiviamo il polling REST anche se la
  // connessione MQTT risulta "aperta" ma silenziosa.
  const lastDataAtRef = useRef<number>(0);
  const lastPositionAtRef = useRef<number>(0);
  const positionsRef = useRef<Map<number, LivePosition>>(new Map());
  const lastResyncAtRef = useRef<number>(0);
  const resyncInFlightRef = useRef(false);
  // Telemetria: messaggi MQTT ricevuti/applicati per topic. In console ogni 30 s:
  // se le posizioni sono ferme si vede subito se è OpenF1 a non mandarle o
  // se le scartiamo noi.
  const statsRef = useRef({
    received: { position: 0, race_control: 0, laps: 0, stints: 0 } as Record<Topic, number>,
    applied: { position: 0, race_control: 0, laps: 0, stints: 0 } as Record<Topic, number>,
    otherSession: 0,
    resyncs: 0,
    resyncRows: 0,
  });

  // Reset quando cambia sessione. Reset intenzionale e poco frequente (solo al
  // cambio di sessionKey): azzeriamo lo stato live per non mostrare dati della
  // sessione precedente.
  useEffect(() => {
    setPositions(new Map());
    positionsRef.current = new Map();
    setRaceControl([]);
    setFastestLap(null);
    setStints([]);
    fastestRef.current = Infinity;
    lastDataAtRef.current = 0;
    lastPositionAtRef.current = 0;
    lastResyncAtRef.current = 0;
    resyncInFlightRef.current = false;
    statsRef.current = {
      received: { position: 0, race_control: 0, laps: 0, stints: 0 },
      applied: { position: 0, race_control: 0, laps: 0, stints: 0 },
      otherSession: 0, resyncs: 0, resyncRows: 0,
    };
    setCurrentLap(null);
    setLastDataAt(0);
    setLastPositionAt(0);
    setMode("init");
  }, [sessionKey]);

  const markPositionsFresh = useCallback(() => {
    lastPositionAtRef.current = Date.now();
    setLastPositionAt(lastPositionAtRef.current);
  }, []);

  const applyPositions = useCallback((rows: { driver_number?: number | null; position?: number | null; date?: string | null }[]) => {
    const next = mergePositions(positionsRef.current, rows);
    if (next === positionsRef.current) return false;
    positionsRef.current = next;
    setPositions(next);
    return true;
  }, []);

  // Applica una risposta /api/live-data (snapshot iniziale, polling o
  // riallineamento parziale con `since`: in quel caso le liste contengono
  // solo il seguito e si FONDONO, non sostituiscono).
  const applyLiveSnapshot = useCallback((data: {
    positions?: LivePosition[];
    raceControl?: LiveRaceControl[];
    laps?: LiveLap[];
    stints?: LiveStint[];
    partial?: boolean;
  }) => {
    if (data.positions?.length || data.raceControl?.length || data.laps?.length || data.stints?.length) {
      lastDataAtRef.current = Date.now();
      setLastDataAt(lastDataAtRef.current);
    }
    if (data.positions?.length) {
      applyPositions(data.positions);
      statsRef.current.resyncRows += data.positions.length;
    }
    if (data.raceControl?.length) {
      // La lista REST è completa: sostituisce la nostra solo se non è più
      // corta (un 429 parziale non deve cancellare messaggi già visti).
      const rc = data.raceControl;
      setRaceControl((prev) => (rc.length >= prev.length ? rc : prev));
    }
    if (data.laps?.length) {
      let fastest = Infinity;
      let fastestDriver = 0;
      for (const l of data.laps) {
        if (l.lap_duration && l.lap_duration > 0 && l.lap_duration < fastest) {
          fastest = l.lap_duration;
          fastestDriver = l.driver_number;
        }
      }
      if (fastestDriver && fastest < fastestRef.current) {
        fastestRef.current = fastest;
        setFastestLap({ driver_number: fastestDriver, duration: fastest });
      }
      let maxLap = 0;
      for (const l of data.laps) if (l.lap_number && l.lap_number > maxLap) maxLap = l.lap_number;
      if (maxLap > 0) setCurrentLap((prev) => (prev == null || maxLap > prev ? maxLap : prev));
    }
    if (data.stints?.length) {
      const st = data.stints;
      setStints((prev) => (st.length >= prev.length ? st : prev));
    }
  }, [applyPositions]);

  /**
   * Fetch REST. Con `since` chiede solo le posizioni (e i giri) successivi
   * all'ultima nota: poco traffico, quindi si può fare spesso. Una risposta
   * ok, anche vuota, conferma che la classifica è allineata.
   */
  const fetchLiveData = useCallback(async (sk: number, signal: AbortSignal, since?: string | null) => {
    try {
      const url = `/api/live-data?session_key=${sk}${since ? `&since=${encodeURIComponent(since)}` : ""}`;
      const res = await fetch(url, { cache: "no-store", signal });
      if (!res.ok) {
        console.warn("[live-ws] /api/live-data response not ok", res.status);
        return false;
      }
      const data = await res.json();
      applyLiveSnapshot(data);
      if (data.positionsOk !== false) markPositionsFresh();
      return true;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return false;
      console.warn("[live-ws] fetchLiveData failed", err);
      return false;
    }
  }, [applyLiveSnapshot, markPositionsFresh]);

  useEffect(() => {
    if (!sessionKey) return;

    let client: mqtt.MqttClient | null = null;
    const abortCtrl = new AbortController();
    let cancelled = false;

    // Riallineamento posizioni via REST, con `since` = ultima posizione nota.
    // Al massimo uno ogni RESYNC_MIN_GAP_MS e mai due in parallelo.
    const resync = async (reason: string, force = false) => {
      if (cancelled || resyncInFlightRef.current) return;
      const now = Date.now();
      if (!force && now - lastResyncAtRef.current < RESYNC_MIN_GAP_MS) return;
      lastResyncAtRef.current = now;
      resyncInFlightRef.current = true;
      statsRef.current.resyncs++;
      const since = latestPositionDate(positionsRef.current);
      try {
        await fetchLiveData(sessionKey!, abortCtrl.signal, since);
      } finally {
        resyncInFlightRef.current = false;
      }
      if (!cancelled && process.env.NODE_ENV !== "production") {
        console.log(`[live-ws] resync (${reason}) since=${since ?? "inizio"}`);
      }
    };

    // Safety-net: gira sempre finché la sessione è attiva.
    //   - nessun dato per STALE_DATA_MS (MQTT non connesso O connesso ma muto)
    //     → polling REST completo, come prima;
    //   - dati sì ma POSIZIONI ferme per STALE_POSITIONS_MS → riallineamento
    //     parziale. È il caso "race control scorre, punteggi fermi".
    const safetyTimer: ReturnType<typeof setInterval> = setInterval(() => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastDataAtRef.current > STALE_DATA_MS) {
        setMode("polling");
        void resync("nessun dato");
      } else if (now - lastPositionAtRef.current > STALE_POSITIONS_MS) {
        void resync("posizioni ferme");
      }
    }, SAFETY_CHECK_MS);

    const telemetryTimer: ReturnType<typeof setInterval> = setInterval(() => {
      if (cancelled) return;
      const s = statsRef.current;
      const per = TOPICS.map((t) => `${t}=${s.applied[t]}/${s.received[t]}`).join(" ");
      console.log(
        `[live-ws] sessionKey=${sessionKey} · applicati/ricevuti: ${per} · altra sessione: ${s.otherSession}`
        + ` · resync: ${s.resyncs} (${s.resyncRows} righe) · posizioni ${Math.round((Date.now() - lastPositionAtRef.current) / 1000)} s fa`,
      );
    }, TELEMETRY_EVERY_MS);

    // Tornando in primo piano (iOS sospende la WS in background e i cambi di
    // posizione persi non vengono rimandati) ci si riallinea subito.
    const onVisible = () => {
      if (document.visibilityState === "visible") void resync("primo piano", true);
    };
    document.addEventListener("visibilitychange", onVisible);

    async function connect() {
      try {
        // Fetch dati iniziali via proxy (abortabile se sessionKey cambia)
        lastResyncAtRef.current = Date.now();
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

        let connections = 0;
        client.on("connect", () => {
          setConnected(true);
          connections++;
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
          // Riconnessione: tutto ciò che è cambiato nel frattempo non arriva
          // più via MQTT. Si riallinea subito da REST.
          if (connections > 1) void resync("riconnessione", true);
        });

        // Polling e riconnessione sono gestiti dal safety-net + reconnectPeriod:
        // qui aggiorniamo solo lo stato di connessione per la UI.
        client.on("close", () => setConnected(false));
        client.on("offline", () => setConnected(false));
        client.on("error", (err) => {
          console.warn("[live-ws] mqtt error", err?.message ?? err);
        });

        client.on("message", (_topic: string, payload: Buffer) => {
          try {
            const msg = JSON.parse(payload.toString());
            const topic = _topic.replace(/^\//, "").replace(/^v1\//, "") as Topic;
            const known = TOPICS.includes(topic);

            if (msg.session_key && msg.session_key !== sessionKey) {
              statsRef.current.otherSession++;
              return;
            }
            if (known) statsRef.current.received[topic]++;

            // Dato valido della nostra sessione: aggiorna la freschezza (così il
            // safety-net non fa polling inutile) e segna la modalità "mqtt" push.
            lastDataAtRef.current = Date.now();
            setLastDataAt(lastDataAtRef.current);
            setMode("mqtt");

            if (topic === "position" && msg.driver_number && msg.position) {
              // Il flusso posizioni è vivo: conta anche se la posizione è
              // uguale a quella nota (OpenF1 può ripubblicare lo stesso stato).
              markPositionsFresh();
              if (applyPositions([msg])) statsRef.current.applied.position++;
            }

            if (topic === "race_control" && msg.message) {
              statsRef.current.applied.race_control++;
              setRaceControl((prev) => [...prev, {
                message: msg.message,
                flag: msg.flag,
                driver_number: msg.driver_number,
                date: msg.date || new Date().toISOString(),
                category: msg.category,
              }]);
            }

            if (topic === "laps" && msg.lap_number) {
              statsRef.current.applied.laps++;
              const ln = Number(msg.lap_number);
              if (ln > 0) setCurrentLap((prev) => (prev == null || ln > prev ? ln : prev));
            }

            if (topic === "laps" && msg.lap_duration && msg.lap_duration > 0) {
              if (msg.lap_duration < fastestRef.current) {
                fastestRef.current = msg.lap_duration;
                setFastestLap({
                  driver_number: msg.driver_number,
                  duration: msg.lap_duration,
                });
              }
            }

            if (topic === "stints" && msg.compound) {
              statsRef.current.applied.stints++;
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
      clearInterval(telemetryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      if (client) {
        client.end(true);
        clientRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionKey, fetchLiveData, applyPositions, markPositionsFresh]);

  return { positions, raceControl, fastestLap, stints, connected, mode, currentLap, lastDataAt, lastPositionAt };
}
