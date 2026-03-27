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

export interface LiveData {
  positions: Map<number, LivePosition>; // ultimo per driver_number
  raceControl: LiveRaceControl[];       // tutti i messaggi, ordine cronologico
  fastestLap: { driver_number: number; duration: number } | null;
  stints: LiveStint[];
  connected: boolean;
}

/**
 * Hook WebSocket MQTT per dati live OpenF1.
 * Si connette a wss://mqtt.openf1.org:8084/mqtt con token OAuth2.
 * Subscribe a: v1/position, v1/race_control, v1/laps, v1/stints
 * Filtra per session_key corrente.
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

  // Fetch iniziale dati storici della sessione via REST
  const fetchInitialData = useCallback(async (sk: number, token: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    const opts = { headers, cache: "no-store" as RequestCache };

    try {
      // Posizioni
      const posRes = await fetch(`https://api.openf1.org/v1/position?session_key=${sk}`, opts);
      if (posRes.ok) {
        const posData: LivePosition[] = await posRes.json();
        const posMap = new Map<number, LivePosition>();
        for (const p of posData) {
          const existing = posMap.get(p.driver_number);
          if (!existing || p.date > existing.date) {
            posMap.set(p.driver_number, p);
          }
        }
        setPositions(posMap);
      }

      // Race control
      const rcRes = await fetch(`https://api.openf1.org/v1/race_control?session_key=${sk}`, opts);
      if (rcRes.ok) {
        const rcData: LiveRaceControl[] = await rcRes.json();
        setRaceControl(rcData);
      }

      // Laps (per fastest lap)
      const lapRes = await fetch(`https://api.openf1.org/v1/laps?session_key=${sk}`, opts);
      if (lapRes.ok) {
        const lapData: LiveLap[] = await lapRes.json();
        let fastest = Infinity;
        let fastestDriver = 0;
        for (const l of lapData) {
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
      const stintRes = await fetch(`https://api.openf1.org/v1/stints?session_key=${sk}`, opts);
      if (stintRes.ok) {
        const stintData: LiveStint[] = await stintRes.json();
        setStints(stintData);
      }
    } catch {
      // Errori non bloccanti, i dati arriveranno via WS
    }
  }, []);

  useEffect(() => {
    if (!sessionKey) return;

    let client: mqtt.MqttClient | null = null;

    async function connect() {
      // Ottieni token
      try {
        const tokenRes = await fetch("/api/openf1-token");
        if (!tokenRes.ok) return;
        const { access_token } = await tokenRes.json();
        if (!access_token) return;

        // Fetch dati iniziali
        await fetchInitialData(sessionKey!, access_token);

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
          // Subscribe ai topics
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

            // Filtra per session_key se presente
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
            // Messaggio non parsabile, skip
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
