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

/**
 * Hook WebSocket MQTT per dati live OpenF1.
 * Fetch iniziale via proxy server-side (/api/live-data) per evitare CORS.
 * WebSocket MQTT per aggiornamenti push in tempo reale.
 */
export function useLiveWebSocket(sessionKey: number | null) {
  const [positions, setPositions] = useState<Map<number, LivePosition>>(new Map());
  const [raceControl, setRaceControl] = useState<LiveRaceControl[]>([]);
  const [fastestLap, setFastestLap] = useState<{ driver_number: number; duration: number } | null>(null);
  const [stints, setStints] = useState<LiveStint[]>([]);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const fastestRef = useRef<number>(Infinity);

  // Reset quando cambia sessione
  useEffect(() => {
    setPositions(new Map());
    setRaceControl([]);
    setFastestLap(null);
    setStints([]);
    fastestRef.current = Infinity;
  }, [sessionKey]);

  // Fetch iniziale via proxy server-side (no CORS)
  const fetchInitialData = useCallback(async (sk: number) => {
    try {
      const res = await fetch(`/api/live-data?session_key=${sk}`, { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();

      // Posizioni
      if (data.positions?.length) {
        const posMap = new Map<number, LivePosition>();
        for (const p of data.positions) {
          if (!p.driver_number || !p.position) continue;
          const existing = posMap.get(p.driver_number);
          if (!existing || p.date > existing.date) {
            posMap.set(p.driver_number, p);
          }
        }
        setPositions(posMap);
      }

      // Race control
      if (data.raceControl?.length) {
        setRaceControl(data.raceControl);
      }

      // Laps (fastest lap)
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

      // Stints
      if (data.stints?.length) {
        setStints(data.stints);
      }
    } catch {
      // Non bloccante, i dati arriveranno via WS
    }
  }, []);

  useEffect(() => {
    if (!sessionKey) return;

    let client: mqtt.MqttClient | null = null;

    async function connect() {
      try {
        // Fetch dati iniziali via proxy
        await fetchInitialData(sessionKey!);

        // Ottieni token per WebSocket
        const tokenRes = await fetch("/api/openf1-token");
        if (!tokenRes.ok) return;
        const { access_token } = await tokenRes.json();
        if (!access_token) return;

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
          client!.subscribe([
            "v1/position",
            "v1/race_control",
            "v1/laps",
            "v1/stints",
          ]);
        });

        client.on("close", () => setConnected(false));
        client.on("offline", () => setConnected(false));
        client.on("error", () => {});

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
          } catch {
            // Skip
          }
        });
      } catch {
        // Errore connessione
      }
    }

    connect();

    return () => {
      if (client) {
        client.end(true);
        clientRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionKey, fetchInitialData]);

  return { positions, raceControl, fastestLap, stints, connected };
}
