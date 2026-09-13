// Helper server-side per chiamate OpenF1 (con token OAuth2 se configurato).

export const OPENF1 = "https://api.openf1.org/v1";

async function getOpenF1Token(): Promise<string | null> {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;
  try {
    const res = await fetch("https://api.openf1.org/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "password", username, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OpenF1 limita le richieste al secondo: quando si supera risponde 429 e,
 * sotto carico, a volte 5xx. Prima `fetchJson` tornava [] in silenzio e il
 * chiamante non distingueva "nessun dato" da "chiamata rifiutata": nell'audit
 * del 13/09/2026 sei round su tredici sono risultati "senza griglia" e "senza
 * qualifica" solo per questo. Qui si riprova con attesa crescente.
 */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface OpenF1Response<T = any> {
  ok: boolean;
  status: number;
  data: T[];
  /** Quante volte è stato necessario riprovare */
  retries: number;
}

/**
 * Chiamata OpenF1 con esito esplicito. Un `session_result` vuoto per "non
 * ancora pubblicato" (404 "No results found") non è la stessa cosa di un 401
 * per token scaduto o di un 429 per troppe richieste, e chi chiama deve
 * poterlo dire.
 */
export async function fetchOpenF1<T = any>(url: string): Promise<OpenF1Response<T>> {
  const token = await getOpenF1Token();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  let retries = 0;
  for (;;) {
    let status = 0;
    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      status = res.status;
      if (res.ok) {
        const data = await res.json();
        return { ok: true, status, data: Array.isArray(data) ? data : [], retries };
      }
    } catch {
      status = 0;
    }
    const retryable = status === 0 || RETRY_STATUSES.has(status);
    if (!retryable || retries >= RETRY_DELAYS_MS.length) return { ok: false, status, data: [], retries };
    await sleep(RETRY_DELAYS_MS[retries]);
    retries++;
  }
}

/** Come fetchOpenF1 ma torna solo i dati ([] su errore): per i chiamanti che non distinguono. */
export async function fetchJson(url: string): Promise<any[]> {
  return (await fetchOpenF1(url)).data;
}
