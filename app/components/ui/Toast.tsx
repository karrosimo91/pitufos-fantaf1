"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

// ═══════════════════════════════════════════
// Toast — feedback in basso, sopra la barra di navigazione, con un colore
// per tipo (verde riuscito, ambra attenzione, rosso errore). Prima ogni
// pagina aveva la sua pillola rossa in alto, uguale per "Norris acquistato"
// e per "Errore".
// ═══════════════════════════════════════════

export type ToastKind = "success" | "warning" | "error" | "info";

export interface ToastOptions {
  kind?: ToastKind;
  /** Riga sotto il messaggio: la conseguenza o il rimedio. */
  detail?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<{ show: (message: string, opts?: ToastOptions) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    if (timer.current) clearTimeout(timer.current);
    const item: ToastItem = { id: ++seq.current, message, kind: "info", duration: 3200, ...opts };
    setToast(item);
    timer.current = setTimeout(() => setToast(null), item.duration);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <ToastView toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

const STYLE: Record<ToastKind, { border: string; icon: ReactNode; text: string }> = {
  success: { border: "border-[#2ee59d]/45", icon: <CheckCircle2 size={18} className="text-[#2ee59d] shrink-0" />, text: "text-white" },
  warning: { border: "border-[#ffb000]/45", icon: <AlertTriangle size={18} className="text-[#ffb000] shrink-0" />, text: "text-white" },
  error: { border: "border-[#E8002D]/55", icon: <XCircle size={18} className="text-[#E8002D] shrink-0" />, text: "text-white" },
  info: { border: "border-white/20", icon: <Info size={18} className="text-white/70 shrink-0" />, text: "text-white" },
};

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const st = STYLE[toast.kind ?? "info"];
  // Se c'è una barra fissa (Conferma weekend, rosa modificata) il toast sale
  // sopra di lei invece di coprirla.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".sticky-bar");
    setOffset(bar ? bar.offsetHeight : 0);
  }, [toast.id]);
  return (
    <div
      className="fixed left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
      style={{ bottom: `calc(${84 + offset}px + env(safe-area-inset-bottom, 0px))` }}
    >
      <div
        role="status"
        aria-live="polite"
        onClick={onDismiss}
        className={`toast-in pointer-events-auto w-full max-w-md bg-[#12121e]/95 backdrop-blur-xl border ${st.border} rounded-lg px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex items-start gap-3 cursor-pointer`}
      >
        {st.icon}
        <div className="flex-1 min-w-0">
          <div className={`text-[14px] font-bold leading-tight ${st.text}`}>{toast.message}</div>
          {toast.detail && <div className="text-[12px] text-white/60 mt-0.5 leading-snug">{toast.detail}</div>}
        </div>
        {toast.action && (
          <button
            onClick={(e) => { e.stopPropagation(); toast.action!.onClick(); onDismiss(); }}
            className="font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-[1px] uppercase text-[#E8002D] px-2 py-1 rounded hover:bg-[#E8002D]/10 shrink-0"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Fuori dal provider (test, pagine statiche) non deve esplodere.
  return ctx ?? { show: (msg: string) => console.info("[toast]", msg) };
}
