"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { ArrowLeft, ChevronDown, ChevronRight, Check, X, CheckCheck, Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useCda } from "../lib/use-cda";
import { CDA_SECTIONS_V2, TOTAL_QUESTIONS_V2, CDA_QUESTIONNAIRE_V2_ID, CDA_QUESTIONNAIRE_V2_LABEL, ALL_QUESTIONS_V2 } from "../lib/cda-questions-v2";
import type { CdaQuestion } from "../lib/cda-questions";

function VoteButton({
  active,
  color,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const base = active
    ? `${color} ring-1 ring-current`
    : "bg-white/[0.04] text-white/30 hover:bg-white/[0.08]";
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${base}`}>
      {icon}
      {label}
    </button>
  );
}

function QuestionCard({
  question,
  myVote,
  voteSummary,
  onVote,
}: {
  question: CdaQuestion;
  myVote?: { voto: string; proposta_testo: string | null };
  voteSummary?: { ok: number; ko: number; proposta: number; proposte_testi: string[] };
  onVote: (voto: "ok" | "ko", testo?: string) => void;
}) {
  const s = voteSummary || { ok: 0, ko: 0, proposta: 0, proposte_testi: [] };

  return (
    <div className="py-3 border-b border-white/[0.04] last:border-0">
      <div className="text-[13px] font-medium mb-1">{question.label}</div>
      {question.detail && (
        <div className="text-[11px] text-white/30 mb-2">{question.detail}</div>
      )}

      <div className="flex gap-2 mb-2">
        <VoteButton
          active={myVote?.voto === "ok"}
          color="bg-emerald-500/20 text-emerald-400"
          icon={<Check size={12} />}
          label="OK"
          onClick={() => onVote("ok")}
        />
        <VoteButton
          active={myVote?.voto === "ko"}
          color="bg-red-500/20 text-red-400"
          icon={<X size={12} />}
          label="KO"
          onClick={() => onVote("ko")}
        />
      </div>

      {(s.ok > 0 || s.ko > 0) && (
        <div className="flex items-center gap-3 text-[10px]">
          {s.ok > 0 && <span className="text-emerald-400/60">OK: {s.ok}</span>}
          {s.ko > 0 && <span className="text-red-400/60">KO: {s.ko}</span>}
        </div>
      )}
    </div>
  );
}

function SectionAccordion({
  title,
  badge,
  complete,
  onApproveAll,
  children,
}: {
  title: string;
  badge?: string;
  complete: boolean;
  onApproveAll: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-white/[0.03] border rounded-xl overflow-hidden ${complete ? "border-emerald-500/20" : "border-white/[0.06]"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-all"
      >
        <div className="flex items-center gap-2">
          {complete && <Check size={14} className="text-emerald-400" />}
          <span className="text-sm font-bold">{title}</span>
          {badge && (
            <span className="text-[10px] font-[family-name:var(--font-jetbrains)] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown size={16} className="text-white/30" />
        ) : (
          <ChevronRight size={16} className="text-white/30" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3">
          {/* Bottone approva tutta la sezione */}
          <button
            onClick={(e) => { e.stopPropagation(); onApproveAll(); }}
            className="flex items-center gap-1.5 mb-3 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
          >
            <CheckCheck size={14} />
            Approva tutta la sezione
          </button>
          {children}
        </div>
      )}
    </div>
  );
}

export default function CdaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isMember, loading, draft, summary, totalMembers, setVote, setAllOk, submit, submitting, submitted, hasChanges } = useCda(CDA_QUESTIONNAIRE_V2_ID, ALL_QUESTIONS_V2);
  const [submitError, setSubmitError] = useState(false);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E8002D]/30 border-t-[#E8002D] rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!isMember) {
    return (
      <div className="min-h-screen bg-[#0a0a12] text-white">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
          <Link href="/altro" className="flex items-center gap-1 text-white/30 text-xs mb-4 hover:text-white/50 transition-all">
            <ArrowLeft size={14} /> Altro
          </Link>
          <div className="text-center py-16">
            <div className="text-white/20 text-sm">Sezione riservata al CDA</div>
            <div className="text-white/10 text-xs mt-1">Devi essere membro della lega &quot;Los Pitufos F1 Championship&quot;</div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const votedCount = Object.keys(draft).length;
  const progress = Math.round((votedCount / TOTAL_QUESTIONS_V2) * 100);
  const allAnswered = votedCount === TOTAL_QUESTIONS_V2;
  const missingCount = TOTAL_QUESTIONS_V2 - votedCount;

  const handleSubmit = async () => {
    setSubmitError(false);
    const ok = await submit();
    if (!ok) setSubmitError(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-bottomnav">
        <Link href="/altro" className="flex items-center gap-1 text-white/30 text-xs mb-4 hover:text-white/50 transition-all">
          <ArrowLeft size={14} /> Altro
        </Link>

        <div className="mb-6">
          <div className="text-[10px] tracking-[4px] text-[#E8002D] uppercase font-bold mb-1">
            Sezione riservata al Consiglio di Amministrazione LP
          </div>
          <h1 className="text-2xl font-black font-[family-name:var(--font-oswald)]">
            {CDA_QUESTIONNAIRE_V2_LABEL.toUpperCase()}
          </h1>
          <p className="text-white/30 text-xs mt-1">Vota le modifiche proposte ai punteggi</p>
        </div>

        {/* Progress */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Il tuo progresso</span>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs font-bold">
              {votedCount}/{TOTAL_QUESTIONS_V2}
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E8002D] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {totalMembers > 0 && (
            <div className="text-[10px] text-white/20 mt-2">
              {totalMembers} {totalMembers === 1 ? "membro ha" : "membri hanno"} votato
            </div>
          )}
          {submitted && !hasChanges && (
            <div className="text-[10px] text-emerald-400/60 mt-1">Voti inviati</div>
          )}
        </div>

        {/* Sezioni */}
        <div className="space-y-2 mb-6">
          {CDA_SECTIONS_V2.map((section) => {
            const sectionVoted = section.questions.filter((q) => draft[q.id]).length;
            const sectionComplete = sectionVoted === section.questions.length;
            const badge = `${sectionVoted}/${section.questions.length}`;
            return (
              <SectionAccordion
                key={section.id}
                title={section.title}
                badge={badge}
                complete={sectionComplete}
                onApproveAll={() => setAllOk(section.questions.map((q) => q.id))}
              >
                {section.questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    myVote={draft[q.id]}
                    voteSummary={summary[q.id]}
                    onVote={(voto, testo) => setVote(q.id, voto, testo)}
                  />
                ))}
              </SectionAccordion>
            );
          })}
        </div>

        {/* Bottone INVIA */}
        <div className="sticky bottom-20 z-10">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting || (submitted && !hasChanges)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all ${
              allAnswered && hasChanges
                ? "bg-[#E8002D] text-white hover:bg-[#c5002a] shadow-lg shadow-[#E8002D]/20"
                : submitted && !hasChanges
                  ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                  : "bg-white/[0.05] text-white/20 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : submitted && !hasChanges ? (
              <>
                <Check size={16} />
                Voti inviati
              </>
            ) : (
              <>
                <Send size={16} />
                {allAnswered ? "INVIA VOTI" : `Ancora ${missingCount} da votare`}
              </>
            )}
          </button>
          {submitError && (
            <div className="text-center text-red-400 text-xs mt-2">
              Errore nell&apos;invio. Riprova.
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
