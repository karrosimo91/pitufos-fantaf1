import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServerClient } from "../../lib/supabase-server";
import { RACES_2026 } from "../../lib/races";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
const FROM_EMAIL = () => process.env.SENDER_EMAIL || "LP FantaF1 <onboarding@resend.dev>";
const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || "https://pitufos-fantaf1.vercel.app";

/**
 * GET /api/send-reminders
 * Chiamato da Vercel Cron — manda email reminder a chi non ha confermato
 * formazione o previsioni per il prossimo round con deadline nelle prossime 2 ore.
 *
 * Può anche essere chiamato manualmente con POST + admin_key.
 */
async function handleReminders(forceRound?: number) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY mancante" }, { status: 500 });
  }

  // Trova il round con deadline nelle prossime 2 ore (o forzato)
  const now = new Date();
  let targetRace = forceRound
    ? RACES_2026.find((r) => r.round === forceRound)
    : RACES_2026.find((r) => {
        const deadline = new Date(r.deadline);
        const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntil > 0 && hoursUntil <= 2;
      });

  if (!targetRace) {
    return NextResponse.json({ message: "Nessuna deadline imminente", sent: 0 });
  }

  const round = targetRace.round;

  // Prendi tutti i profili con email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, team_principal_name, scuderia_name");

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: "Nessun profilo trovato", sent: 0 });
  }

  // Prendi formazioni confermate per questo round
  const { data: formazioni } = await supabase
    .from("formazioni")
    .select("user_id, confirmed")
    .eq("round", round);

  // Prendi previsioni confermate per questo round
  const { data: previsioni } = await supabase
    .from("previsioni")
    .select("user_id, confirmed")
    .eq("round", round);

  const confirmedFormazioni = new Set(
    (formazioni || []).filter((f) => f.confirmed).map((f) => f.user_id)
  );
  const confirmedPrevisioni = new Set(
    (previsioni || []).filter((p) => p.confirmed).map((p) => p.user_id)
  );

  // Trova chi NON ha confermato almeno una delle due
  const toNotify = profiles.filter((p) => {
    if (!p.email) return false;
    const hasFormazione = confirmedFormazioni.has(p.id);
    const hasPrevisioni = confirmedPrevisioni.has(p.id);
    return !hasFormazione || !hasPrevisioni;
  });

  if (toNotify.length === 0) {
    return NextResponse.json({ message: "Tutti hanno confermato!", sent: 0, round });
  }

  // Calcola tempo rimanente
  const deadline = new Date(targetRace.deadline);
  const diffMs = deadline.getTime() - now.getTime();
  const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
  const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const timeLeft = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft} minuti`;

  // Manda le email
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const user of toNotify) {
    const hasFormazione = confirmedFormazioni.has(user.id);
    const hasPrevisioni = confirmedPrevisioni.has(user.id);

    const missing: string[] = [];
    if (!hasFormazione) missing.push("formazione e Primo Pilota");
    if (!hasPrevisioni) missing.push("previsioni");

    try {
      await getResend().emails.send({
        from: FROM_EMAIL(),
        to: user.email,
        subject: `⏰ Deadline ${targetRace.name} tra ${timeLeft}!`,
        html: buildReminderEmail({
          teamPrincipal: user.team_principal_name || "Team Principal",
          raceName: targetRace.name,
          circuit: targetRace.circuit,
          timeLeft,
          missing,
          siteUrl: SITE_URL(),
        }),
      });
      results.push({ email: user.email, ok: true });
    } catch (err) {
      results.push({
        email: user.email,
        ok: false,
        error: err instanceof Error ? err.message : "Errore sconosciuto",
      });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    round,
    race: targetRace.name,
    total_users: profiles.length,
    notified: toNotify.length,
    sent,
    failed,
    results,
  });
}

// GET: chiamato da Vercel Cron
export async function GET(request: NextRequest) {
  // Verifica cron secret (opzionale ma consigliato)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  return handleReminders();
}

// POST: chiamato manualmente con admin_key + round opzionale
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { admin_key, round } = body;

  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || admin_key !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  return handleReminders(round);
}

// ─── Email HTML template ───
function buildReminderEmail({
  teamPrincipal,
  raceName,
  circuit,
  timeLeft,
  missing,
  siteUrl,
}: {
  teamPrincipal: string;
  raceName: string;
  circuit: string;
  timeLeft: string;
  missing: string[];
  siteUrl: string;
}) {
  const missingList = missing.map((m) => `<li style="margin-bottom:4px">${m}</li>`).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a12;color:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">

    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:11px;letter-spacing:3px;color:#E8002D;text-transform:uppercase;font-weight:bold">Los Pitufos FantaF1</div>
      <div style="font-size:24px;font-weight:900;margin-top:4px">DEADLINE REMINDER</div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:16px">
      <div style="font-size:13px;color:rgba(255,255,255,0.4)">Ciao ${teamPrincipal},</div>
      <div style="font-size:15px;margin-top:12px">
        La deadline per il <strong>${raceName}</strong> (${circuit}) scade tra <strong style="color:#E8002D">${timeLeft}</strong>!
      </div>
      <div style="font-size:13px;margin-top:16px;color:rgba(255,255,255,0.5)">
        Non hai ancora confermato:
      </div>
      <ul style="font-size:14px;margin-top:8px;padding-left:20px;color:rgba(255,255,255,0.7)">
        ${missingList}
      </ul>
    </div>

    <a href="${siteUrl}/dashboard" style="display:block;text-align:center;background:#E8002D;color:#ffffff;text-decoration:none;padding:14px;border-radius:12px;font-weight:bold;font-size:14px">
      CONFERMA ORA
    </a>

    <div style="text-align:center;margin-top:24px;font-size:10px;color:rgba(255,255,255,0.15)">
      Los Pitufos FantaF1 — Stagione 2026
    </div>
  </div>
</body>
</html>`;
}
