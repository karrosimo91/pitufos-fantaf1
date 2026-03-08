"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";

interface Section {
  title: string;
  content: React.ReactNode;
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-all"
      >
        <span className="text-sm font-bold">{title}</span>
        {open ? <ChevronDown size={16} className="text-white/30" /> : <ChevronRight size={16} className="text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4 text-[13px] text-white/60 leading-relaxed space-y-3">{children}</div>}
    </div>
  );
}

function PuntiTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="bg-black/20 rounded-lg overflow-hidden">
      {rows.map(([label, pts], i) => (
        <div key={i} className={`flex justify-between px-3 py-1.5 text-xs ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
          <span className="text-white/50">{label}</span>
          <span className="font-[family-name:var(--font-jetbrains)] font-bold text-white/70">{pts}</span>
        </div>
      ))}
    </div>
  );
}

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <Link href="/altro" className="flex items-center gap-1 text-white/30 text-xs mb-4 hover:text-white/50 transition-all">
          <ArrowLeft size={14} /> Altro
        </Link>

        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">Los Pitufos FantaF1</div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)]">REGOLAMENTO</h1>
        </div>

        <div className="space-y-2">
          {/* Struttura */}
          <Accordion title="Struttura del gioco">
            <p>Ogni giocatore e un <strong>Team Principal</strong> e gestisce la propria <strong>Scuderia</strong>.</p>
            <p>Budget iniziale: <strong>100 Soldini</strong>. Ogni scuderia ha <strong>5 piloti</strong>.</p>
            <p>Stagione 2026: 24 GP, 6 weekend sprint, 22 piloti, 11 scuderie.</p>
            <p>Le quotazioni dei piloti variano dopo ogni GP.</p>
          </Accordion>

          {/* Primo Pilota */}
          <Accordion title="Primo Pilota (Capitano)">
            <p>Ogni weekend scegli 1 pilota come <strong>Primo Pilota</strong>.</p>
            <p>Il suo punteggio viene <strong>raddoppiato (x2)</strong>, sia bonus che malus.</p>
            <p>Esempio: se il Primo Pilota fa DNF (-15), il malus diventa <strong>-30</strong>.</p>
          </Accordion>

          {/* Punteggi Qualifica */}
          <Accordion title="Punteggi Qualifica GP">
            <PuntiTable rows={[
              ["Pole (P1)", "+8"],
              ["P2", "+6"],
              ["P3", "+5"],
              ["P4 - P5", "+4"],
              ["P6 - P10 (Q3)", "+3"],
              ["P11 - P16 (Q2)", "+1"],
              ["P17 - P22 (Q1)", "-1"],
              ["NC / DSQ / No tempo", "-5"],
              ["Penalita in griglia", "0"],
            ]} />
          </Accordion>

          {/* Sprint Shootout */}
          <Accordion title="Punteggi Sprint Shootout">
            <PuntiTable rows={[
              ["Pole sprint", "+4"],
              ["P2", "+3"],
              ["P3", "+2"],
              ["P4 - P10 (SQ3)", "+1"],
              ["P11 - P16 (SQ2)", "0"],
              ["P17 - P22 (SQ1)", "-1"],
              ["NC", "-3"],
            ]} />
          </Accordion>

          {/* Sprint Race */}
          <Accordion title="Punteggi Sprint Race">
            <PuntiTable rows={[
              ["P1", "+8"],
              ["P2", "+7"],
              ["P3", "+6"],
              ["P4", "+5"],
              ["P5", "+4"],
              ["P6", "+3"],
              ["P7", "+2"],
              ["P8", "+1"],
              ["P9 - P22", "0"],
              ["Giro veloce sprint", "+2"],
              ["DNF sprint", "-10"],
            ]} />
            <p className="text-xs text-white/30">Nessun punto per posizioni guadagnate/perse in sprint.</p>
          </Accordion>

          {/* Gara */}
          <Accordion title="Punteggi Gara (Gran Premio)">
            <PuntiTable rows={[
              ["P1", "+25"],
              ["P2", "+18"],
              ["P3", "+15"],
              ["P4", "+12"],
              ["P5", "+10"],
              ["P6", "+8"],
              ["P7", "+6"],
              ["P8", "+4"],
              ["P9", "+2"],
              ["P10", "+1"],
              ["P11 - P22", "0"],
              ["Posizione guadagnata vs griglia", "+1 /pos"],
              ["Posizione persa vs griglia", "-0.5 /pos"],
              ["Giro veloce", "+3"],
              ["Driver of the Day", "+5"],
              ["DNF / Ritiro", "-15"],
              ["Penalita in gara", "-5"],
            ]} />
          </Accordion>

          {/* Previsioni */}
          <Accordion title="Previsioni (6 per weekend)">
            <p>Punti differenziati in base alla probabilita dell'evento:</p>
            <PuntiTable rows={[
              ["Safety Car: SI", "+4"],
              ["Safety Car: NO", "+6"],
              ["Virtual Safety Car: SI", "+5"],
              ["Virtual Safety Car: NO", "+5"],
              ["Red Flag: SI", "+7"],
              ["Red Flag: NO", "+3"],
              ["Gomme wet: SI", "+8"],
              ["Gomme wet: NO", "+2"],
              ["Pole vince: SI", "+3"],
              ["Pole vince: NO", "+7"],
              ["Numero DNF esatto", "+8"],
            ]} />
            <p className="text-xs text-white/30">Previsione sbagliata = 0 punti.</p>
          </Accordion>

          {/* Aggiornamenti */}
          <Accordion title="Aggiornamenti (Chip)">
            <p>Ogni chip ha <strong>2 utilizzi</strong>: 1 prima della pausa estiva, 1 dopo. Se non lo usi, scade.</p>
            <p>Max 1 Aggiornamento Piloti + 1 Aggiornamento Previsioni per weekend.</p>

            <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mt-3 mb-1">Aggiornamenti Piloti</div>
            <PuntiTable rows={[
              ["Boost Mode (x3)", "Un pilota diverso dal Primo Pilota fa x3"],
              ["Halo", "Se un pilota va in negativo, minimo 0 punti"],
              ["Sost. Griglia", "1 cambio squadra post-qualifica"],
              ["Sesto Uomo", "6o pilota temporaneo per un weekend"],
            ]} />

            <div className="text-[10px] tracking-[2px] text-white/30 uppercase font-bold mt-3 mb-1">Aggiornamenti Previsioni</div>
            <PuntiTable rows={[
              ["Prev. Sicura", "1 previsione vale comunque"],
              ["Prev. Doppia", "Punti x2 su 1 previsione"],
              ["Prev. Tardiva", "Cambia 1 previsione dopo le qualifiche"],
            ]} />
          </Accordion>

          {/* Bonus */}
          <Accordion title="Bonus Automatici">
            <p><strong>All-in Previsioni:</strong> tutte e 6 le previsioni giuste = bonus automatico.</p>
            <p><strong>Weekend Perfetto:</strong> Primo Pilota vince + tutte le previsioni giuste = super bonus.</p>
            <p className="text-xs text-white/30">Punteggio bonus da definire.</p>
          </Accordion>

          {/* Deadline */}
          <Accordion title="Deadline">
            <p><strong>Weekend normali:</strong> prima delle qualifiche (sabato). Avrai visto FP1, FP2, FP3.</p>
            <p><strong>Weekend sprint:</strong> prima della Sprint Shootout (venerdi). Avrai visto solo FP1.</p>
            <p>Si blocca tutto insieme: formazione, Primo Pilota, chip, previsioni.</p>
          </Accordion>

          {/* Classifiche */}
          <Accordion title="Doppia Classifica">
            <p><strong>1. Classifica Somma Punti (PRINCIPALE):</strong> somma totale di tutti i punti weekend dopo weekend.</p>
            <p><strong>2. Classifica Reale:</strong> ogni weekend i giocatori vengono classificati. Top 10 prendono punti F1 (25-18-15-12-10-8-6-4-2-1), gli altri 0.</p>
          </Accordion>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
