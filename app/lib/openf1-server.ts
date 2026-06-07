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
