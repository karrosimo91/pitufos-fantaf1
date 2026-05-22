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

const MQTT_WATCHDOG_MS = 8000;     // se entro 8s non si connette → polling
const REST_POLL_INTERVAL_MS = 15000; // refresh ogni 15s in fallback

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

  // Reset quando cambia sessione
  useEffect(() => {
    setPositions(new Map());
    setRaceControl([]);
    setFastestLap(null);
    setStints([]);
    fastestRef.current = Infinity;
    setMode("init");
  }, [sessionKey]);

  // Applica una risposta /api/live-data (sia per init che per polling)
  const applyLiveSnapshot = useCallback((data: {
    positions?: LivePosition[];
    raceControl?: LiveRaceControl[];
    laps?: LiveLap[];
    stints?: LiveStint[];
  }) => {
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
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      if (pollTimer || cancelled) return;
      console.warn("[live-ws] entering REST polling fallback");
      setMode("polling");
      pollTimer = setInterval(() => {
        if (cancelled) return;
        fetchLiveData(sessionKey!, abortCtrl.signal);
      }, REST_POLL_INTERVAL_MS);
    };

    async function connect() {
      try {
        // Fetch dati iniziali via proxy (abortabile se sessionKey cambia)
        await fetchLiveData(sessionKey!, abortCtrl.signal);
        if (cancelled) return;

        // Ottieni token per WebSocket
        const tokenRes = await fetch("/api/openf1-token", { signal: abortCtrl.signal });
        if (!tokenRes.ok) {
          console.warn("[live-ws] /api/openf1-token response not ok", tokenRes.status);
          startPolling();
          return;
        }
        const { access_token } = await tokenRes.json();
        if (!access_token) {
          console.warn("[live-ws] empty access_token, MQTT will not connect");
          startPolling();
          return;
        }
        if (cancelled) return;

        // Watchdog: se entro N secondi non siamo connessi via MQTT, parti col polling
        watchdog = setTimeout(() => {
          if (!cancelled && mode !== "mqtt") {
            console.warn("[live-ws] MQTT watchdog timeout, falling back to polling");
            startPolling();
          }
        }, MQTT_WATCHDOG_MS);

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
          setMode("mqtt");
          stopPolling();
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          client!.subscribe([
            "v1/position",
            "v1/race_control",
            "v1/laps",
            "v1/stints",
          ]);
        });

        client.on("close", () => {
          setConnected(false);
          if (!cancelled) startPolling();
        });
        client.on("offline", () => {
          setConnected(false);
          if (!cancelled) startPolling();
        });
        client.on("error", (err) => {
          console.warn("[live-ws] mqtt error", err?.message ?? err);
          if (!cancelled) startPolling();
        });

        client.on("message", (_topic: string, payload: Buffer) => {
          try {
            const msg = JSON.parse(payload.toString());
            if (msg.session_key && msg.session_key !== sessionKey) return;

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
        console.warn("[live-ws] connect() failed, starting polling fallback", err);
        startPolling();
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortCtrl.abort();
      if (watchdog) clearTimeout(watchdog);
      stopPolling();
      if (client) {
        client.end(true);
        clientRef.current = null;
      }
      setConnected(false);
    };
    // mode è gestito internamente, escluso volutamente dalle dipendenze
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, fetchLiveData]);

  return { positions, raceControl, fastestLap, stints, connected, mode };
}
