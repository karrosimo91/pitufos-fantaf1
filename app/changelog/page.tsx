"use client";
import Link from "next/link";
import { ChevronLeft, Sparkles, Bug, Wrench, Palette } from "lucide-react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { CHANGELOG, type ChangelogSection } from "../lib/changelog-data";
import { APP_VERSION } from "../lib/types";

function sectionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("novit")) return Sparkles;
  if (t.includes("fix")) return Bug;
  if (t.includes("design")) return Palette;
  return Wrench;
}

function sectionAccent(title: string) {
  const t = title.toLowerCase();
  if (t.includes("novit")) return { color: "var(--accent)", bg: "rgba(232,0,45,0.08)", border: "rgba(232,0,45,0.35)" };
  if (t.includes("fix")) return { color: "var(--green)", bg: "rgba(0,255,136,0.06)", border: "rgba(0,255,136,0.3)" };
  if (t.includes("design")) return { color: "var(--purple)", bg: "rgba(176,38,255,0.06)", border: "rgba(176,38,255,0.3)" };
  return { color: "var(--amber)", bg: "rgba(255,176,0,0.05)", border: "rgba(255,176,0,0.3)" };
}

function SectionBlock({ section }: { section: ChangelogSection }) {
  const Icon = sectionIcon(section.title);
  const a = sectionAccent(section.title);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={11} style={{ color: a.color }} />
        <span className="hud-label" style={{ color: a.color }}>{section.title.toUpperCase()}</span>
      </div>
      <ul className="space-y-1.5">
        {section.items.map((item, i) => (
          <li
            key={i}
            className="text-[13px] text-white/75 leading-[1.45] pl-3 border-l-2"
            style={{ borderLeftColor: a.border }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white bg-grid">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <Link
          href="/altro"
          className="inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[1.5px] text-white/40 hover:text-white/70 uppercase mb-4"
        >
          <ChevronLeft size={12} /> ALTRO
        </Link>

        <div className="mb-6">
          <div className="font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[2.5px] text-[#E8002D] uppercase font-bold mb-1.5">
            VERSIONE CORRENTE · {APP_VERSION}
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.8px] leading-none">Changelog</h1>
          <p className="text-[13px] text-white/45 mt-2">Tutte le novità, fix e cambi sotto il cofano.</p>
        </div>

        <div className="space-y-4">
          {CHANGELOG.map((release) => {
            const isLatest = release.version === APP_VERSION;
            return (
              <div key={release.version} className={`hud-card ${isLatest ? "hud-card-accent" : ""}`}>
                <div className="hud-card-head">
                  <div className="flex items-center gap-2">
                    <span className={`font-[family-name:var(--font-jetbrains)] text-[13px] font-extrabold tabular-nums ${isLatest ? "text-[#E8002D]" : "text-white/80"}`}>
                      {release.version}
                    </span>
                    {isLatest && (
                      <span className="font-[family-name:var(--font-jetbrains)] text-[8px] font-bold tracking-[1.5px] px-1.5 py-0.5 rounded bg-[#E8002D]/15 border border-[#E8002D]/35 text-[#E8002D]">
                        ATTUALE
                      </span>
                    )}
                  </div>
                  <div className="hud-meta">{release.date.toUpperCase()}</div>
                </div>
                <div className="p-4">
                  {release.summary && (
                    <p className="text-[14px] text-white/80 font-medium mb-1 tracking-[-0.2px]">{release.summary}</p>
                  )}
                  {release.sections.map((s, i) => (
                    <SectionBlock key={i} section={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8 font-[family-name:var(--font-jetbrains)] text-[10px] text-white/20 tracking-[1.5px] uppercase">
          Fine · Los Pitufos FantaF1 · {APP_VERSION}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
