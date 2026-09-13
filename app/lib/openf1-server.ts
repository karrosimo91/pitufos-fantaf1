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

export async function fetchJson(url: string): Promise<any[]> {
  const token = await getOpenF1Token();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export interface OpenF1Response<T = any> {
  ok: boolean;
  status: number;
  data: T[];
}

/**
 * Come fetchJson, ma dice anche com'è andata la chiamata. Serve dove la
 * differenza conta: un `session_result` vuoto per "non ancora pubblicato"
 * (404 "No results found") non è la stessa cosa di un 401 per token scaduto
 * o di un 5xx, e il messaggio all'admin deve dirlo.
 */
export async function fetchOpenF1<T = any>(url: string): Promise<OpenF1Response<T>> {
  const token = await getOpenF1Token();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status, data: [] };
    const data = await res.json();
    return { ok: true, status: res.status, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, status: 0, data: [] };
  }
}
