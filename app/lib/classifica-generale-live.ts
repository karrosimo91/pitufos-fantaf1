/**
 * Classifica Generale live: classifica di stagione della lega con il weekend
 * in corso sommato in tempo reale, più i distacchi fra posizioni adiacenti e
 * i duelli (primo contro secondo, secondo contro terzo, …).
 *
 * Funzioni pure, senza React: le usa `use-classifica-generale-live.ts`.
 *
 * `liveWeekendPoints` è cumulativo sul weekend (comprende le sessioni già in
 * archivio), mentre il totale di stagione include già quanto il post-gara ha
 * calcolato per questo round (es. la qualifica). Sommarli direttamente contava
 * due volte quella sessione: dal totale si toglie quanto il round ha già dato
 * (`roundSalvato`, da `weekend_scores`) e si aggiunge il cumulativo live.
 */

export interface SeasonTotalInput {
  user_id: string;
  team_principal_name: string;
  scuderia_name: string;
  total_points: number;
}

export interface GeneraleLiveRow {
  userId: string;
  scuderiaName: string;
  tpName: string;
  /** Totale di stagione con il weekend in corso */
  total: number;
  /** Totale di stagione prima del weekend (senza questo round) */
  totalBefore: number;
  /** Punti del weekend in corso, cumulativi */
  liveWeekend: number;
  /** Posizione ora (1-based) */
  position: number;
  /** Posizione a inizio weekend (1-based) */
  positionBefore: number;
  /** Distacco da chi precede (positivo); null per il leader */
  gapAhead: number | null;
  /** Distacco dal leader (0 per il leader) */
  gapLeader: number;
  isMe: boolean;
}

export interface DuelloLive {
  /** Posizione di chi precede (1-based): il duello è `position` vs `position + 1` */
  position: number;
  ahead: GeneraleLiveRow;
  behind: GeneraleLiveRow;
  /** Distacco attuale fra i due (≥ 0) */
  gap: number;
  /** Distacco a inizio weekend fra gli stessi due (negativo se l'ordine era inverso) */
  gapBefore: number;
  /** gap − gapBefore: > 0 chi precede allunga, < 0 chi insegue recupera */
  delta: number;
  /** A inizio weekend l'ordine fra i due era inverso */
  sorpasso: boolean;
  involvesMe: boolean;
}

function sortRows<T extends { total: number; tpName: string; userId: string }>(a: T, b: T): number {
  return b.total - a.total || a.tpName.localeCompare(b.tpName) || a.userId.localeCompare(b.userId);
}

export function buildClassificaGeneraleLive(
  season: SeasonTotalInput[],
  roundSalvato: Map<string, number>,
  liveWeekendPoints: Map<string, number>,
  userId?: string,
): GeneraleLiveRow[] {
  const base = season.map((e) => {
    const live = liveWeekendPoints.get(e.user_id) ?? 0;
    const giaInTotale = roundSalvato.get(e.user_id) ?? 0;
    const totalBefore = e.total_points - giaInTotale;
    return {
      userId: e.user_id,
      scuderiaName: e.scuderia_name,
      tpName: e.team_principal_name,
      total: totalBefore + live,
      totalBefore,
      liveWeekend: live,
      isMe: e.user_id === userId,
    };
  });

  // Posizioni a inizio weekend: stesso ordinamento sul totale senza il round.
  const before = [...base]
    .map((r) => ({ userId: r.userId, tpName: r.tpName, total: r.totalBefore }))
    .sort(sortRows);
  const positionBefore = new Map(before.map((r, i) => [r.userId, i + 1]));

  const sorted = [...base].sort(sortRows);
  const leaderTotal = sorted[0]?.total ?? 0;
  return sorted.map((r, i) => ({
    ...r,
    position: i + 1,
    positionBefore: positionBefore.get(r.userId) ?? i + 1,
    gapAhead: i === 0 ? null : sorted[i - 1].total - r.total,
    gapLeader: leaderTotal - r.total,
  }));
}

/** Duelli fra posizioni adiacenti: 1 vs 2, 2 vs 3, … nell'ordine della classifica. */
export function buildDuelliLive(rows: GeneraleLiveRow[]): DuelloLive[] {
  const duelli: DuelloLive[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const ahead = rows[i];
    const behind = rows[i + 1];
    const gap = ahead.total - behind.total;
    const gapBefore = ahead.totalBefore - behind.totalBefore;
    duelli.push({
      position: ahead.position,
      ahead,
      behind,
      gap,
      gapBefore,
      delta: gap - gapBefore,
      sorpasso: gapBefore < 0 || (gapBefore === 0 && behind.positionBefore < ahead.positionBefore),
      involvesMe: ahead.isMe || behind.isMe,
    });
  }
  return duelli;
}
