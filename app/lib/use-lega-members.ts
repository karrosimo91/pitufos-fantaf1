"use client";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";

/** user_id dei membri di una lega (null = nessun filtro). */
export function useLegaMembers(legaId: string | null | undefined) {
  const [members, setMembers] = useState<Set<string> | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    if (!legaId || !isSupabaseConfigured) { setMembers(null); setLoaded(true); return; }
    const supabase = createClient();
    if (!supabase) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("lega_members").select("user_id").eq("lega_id", legaId);
      if (cancelled) return;
      setMembers(data ? new Set(data.map((m) => m.user_id)) : null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [legaId]);
  return { members, loaded };
}
