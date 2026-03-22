"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth";
import { CDA_LEAGUE_ID, ALL_QUESTIONS } from "./cda-questions";

export interface CdaVote {
  voto: "ok" | "ko" | "proposta";
  proposta_testo: string | null;
}

export interface VoteSummary {
  ok: number;
  ko: number;
  proposta: number;
  proposte_testi: string[];
}

// ─── Hook leggero: solo check membership ───
export function useCdaMembership() {
  const { user } = useAuth();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setIsMember(false);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    (async () => {
      const { data: member } = await supabase
        .from("lega_members")
        .select("lega_id")
        .eq("lega_id", CDA_LEAGUE_ID)
        .eq("user_id", user.id)
        .maybeSingle();

      setIsMember(!!member);
      setLoading(false);
    })();
  }, [user]);

  return { isMember, loading };
}

// ─── Hook: check se membro CDA ha completato il questionario ───
// Ritorna: null (non membro, può giocare), true (completato), false (non completato)
export function useCdaCompleted() {
  const { user } = useAuth();
  const [canPlay, setCanPlay] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCanPlay(null);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }

    (async () => {
      // Check membership
      const { data: member } = await supabase
        .from("lega_members")
        .select("lega_id")
        .eq("lega_id", CDA_LEAGUE_ID)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) {
        // Non membro CDA, può giocare liberamente
        setCanPlay(null);
        setLoading(false);
        return;
      }

      // Membro CDA: conta voti
      const { count } = await supabase
        .from("cda_voti")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setCanPlay((count || 0) >= ALL_QUESTIONS.length);
      setLoading(false);
    })();
  }, [user]);

  return { canPlay, loading };
}

// ─── Hook completo: voti locali + salvataggio finale ───
export function useCda() {
  const { user } = useAuth();
  const { isMember, loading: memberLoading } = useCdaMembership();
  const [draft, setDraft] = useState<Record<string, CdaVote>>({});
  const [savedVotes, setSavedVotes] = useState<Record<string, CdaVote>>({});
  const [summary, setSummary] = useState<Record<string, VoteSummary>>({});
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Carica voti esistenti dal DB
  const loadVotes = useCallback(async () => {
    if (!user || !isSupabaseConfigured || !isMember) return;
    const supabase = createClient();
    if (!supabase) return;

    const { data: allVotes } = await supabase
      .from("cda_voti")
      .select("user_id, question_id, voto, proposta_testo");

    if (!allVotes) { setLoading(false); return; }

    // I miei voti → carica nel draft
    const mine: Record<string, CdaVote> = {};
    for (const v of allVotes) {
      if (v.user_id === user.id) {
        mine[v.question_id] = { voto: v.voto, proposta_testo: v.proposta_testo };
      }
    }
    setSavedVotes(mine);
    setDraft(mine);
    setSubmitted(Object.keys(mine).length === ALL_QUESTIONS.length);

    // Riepilogo per domanda (voti degli altri)
    const sum: Record<string, VoteSummary> = {};
    for (const v of allVotes) {
      if (!sum[v.question_id]) {
        sum[v.question_id] = { ok: 0, ko: 0, proposta: 0, proposte_testi: [] };
      }
      const s = sum[v.question_id];
      if (v.voto === "ok") s.ok++;
      else if (v.voto === "ko") s.ko++;
      else if (v.voto === "proposta") {
        s.proposta++;
        if (v.proposta_testo) s.proposte_testi.push(v.proposta_testo);
      }
    }
    setSummary(sum);

    const uniqueUsers = new Set(allVotes.map((v) => v.user_id));
    setTotalMembers(uniqueUsers.size);

    setLoading(false);
  }, [user, isMember]);

  useEffect(() => {
    if (!memberLoading && isMember) loadVotes();
    if (!memberLoading && !isMember) setLoading(false);
  }, [memberLoading, isMember, loadVotes]);

  // Voto locale (solo draft, non salva)
  const setVote = useCallback(
    (questionId: string, voto: "ok" | "ko" | "proposta", testo?: string) => {
      setDraft((prev) => ({
        ...prev,
        [questionId]: {
          voto,
          proposta_testo: voto === "proposta" ? (testo || null) : null,
        },
      }));
      setSubmitted(false);
    },
    []
  );

  // OK a tutta una sezione
  const setAllOk = useCallback(
    (questionIds: string[]) => {
      setDraft((prev) => {
        const next = { ...prev };
        for (const id of questionIds) {
          // Non sovrascrivere se già votato diversamente
          if (!next[id]) {
            next[id] = { voto: "ok", proposta_testo: null };
          }
        }
        return next;
      });
      setSubmitted(false);
    },
    []
  );

  // Invia tutti i voti al DB
  const submit = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return false;
    const supabase = createClient();
    if (!supabase) return false;

    // Controlla che tutte le domande abbiano risposta
    const missing = ALL_QUESTIONS.filter((q) => !draft[q.id]);
    if (missing.length > 0) return false;

    setSubmitting(true);

    const rows = ALL_QUESTIONS.map((q) => ({
      user_id: user.id,
      question_id: q.id,
      voto: draft[q.id].voto,
      proposta_testo: draft[q.id].proposta_testo,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("cda_voti")
      .upsert(rows, { onConflict: "user_id,question_id" });

    setSubmitting(false);

    if (!error) {
      setSavedVotes({ ...draft });
      setSubmitted(true);
      await loadVotes();
      return true;
    }
    return false;
  }, [user, draft, loadVotes]);

  // Controlla se il draft è diverso dai voti salvati
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedVotes);

  return {
    isMember,
    loading: loading || memberLoading,
    draft,
    summary,
    totalMembers,
    setVote,
    setAllOk,
    submit,
    submitting,
    submitted,
    hasChanges,
  };
}
