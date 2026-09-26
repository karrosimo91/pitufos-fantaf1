"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import Muretto from "../components/muretto/Muretto";
import { RecapMini } from "../components/recap/RecapMini";
import { useDashboardStats, useLeghe, useLegaPreferita } from "../lib/store";
import { useWeekend } from "../lib/weekend-context";
import { useAuth } from "../lib/auth";
import { Trophy } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { round, recapRace, squadra } = useWeekend();
  const { leghe, loaded: legheLoaded } = useLeghe();
  const { legaId: legaPreferita, loaded: legaPrefLoaded } = useLegaPreferita();
  const dashStats = useDashboardStats(legaPrefLoaded ? legaPreferita : undefined);
  const currentLega = leghe.find((l) => l.id === legaPreferita);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050507] text-white bg-grid">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
          <div className="skeleton h-16" />
          <div className="skeleton h-28" />
          <div className="skeleton h-56" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const caption = dashStats.loaded
    ? [
        dashStats.position ? `${dashStats.position}° su ${dashStats.totalPlayers}` : null,
        dashStats.position && dashStats.position > 1 ? `−${dashStats.gapLeader} dal leader` : dashStats.position === 1 && dashStats.behind ? `+${dashStats.behind.gap} su ${dashStats.behind.name}` : null,
        `${dashStats.gareGiocate} GP`,
        dashStats.mediaPunti !== null ? `media ${dashStats.mediaPunti}` : null,
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-5 pb-bottomnav">
        {/* Intestazione + hero di stagione */}
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="hud-label text-[#E8002D] mb-1">Team Principal · {profile?.team_principal_name || "—"}</div>
            <h1 className="text-[24px] font-black font-[family-name:var(--font-oswald)] leading-tight truncate">
              {profile?.scuderia_name?.toUpperCase() || "LA MIA SCUDERIA"}
            </h1>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-[family-name:var(--font-jetbrains)] text-[34px] font-extrabold tabular-nums leading-none ${dashStats.loaded ? "text-white" : "text-white/30"}`}>
              {dashStats.loaded ? dashStats.totalPoints : "…"}
            </div>
            <div className="hud-label mt-1">PUNTI</div>
          </div>
        </div>
        <Link href="/classifica" className="flex items-center gap-2 mb-5 text-[12px] text-white/60 tap">
          <Trophy size={12} className="text-[#E8002D] shrink-0" />
          <span className="truncate">
            {legheLoaded && currentLega ? (currentLega.is_generale ? "Classifica generale" : currentLega.name) : "Classifica"}
            {caption ? ` · ${caption}` : ""}
          </span>
        </Link>

        {/* Il weekend appena concluso, finché non chiude il prossimo */}
        {recapRace && recapRace.round !== round && (
          <RecapMini round={recapRace.round} legaId={legaPrefLoaded ? legaPreferita : null} userId={user.id} />
        )}

        {/* Il rito del round corrente */}
        <Muretto key={round} />

        {squadra.loaded && squadra.driverNumbers.length === 0 && (
          <div className="text-[12px] text-white/45 text-center mt-2">Sei nuovo? Parti dal Mercato: 5 piloti con 100 Soldini, poi scegli il Primo Pilota.</div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
