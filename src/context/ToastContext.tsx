/* eslint-disable react-refresh/only-export-components -- provider and its hook belong together */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";
import { cn } from "../utils/cn";

type ToastKind = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const TONES = { success: "text-[var(--green-fg)]", error: "text-[var(--red-fg)]", info: "text-[var(--blue-fg)]", warning: "text-[var(--yellow-fg)]" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, kind, title, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 9000 : 5000);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (t, m) => push("success", t, m),
      error: (t, m) => push("error", t, m),
      info: (t, m) => push("info", t, m),
      warning: (t, m) => push("warning", t, m),
    }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2" aria-live="polite" role="status">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-lg">
              <Icon className={cn("mt-0.5 size-5 shrink-0", TONES[t.kind])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 text-sm text-ink-2">{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss notification">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
