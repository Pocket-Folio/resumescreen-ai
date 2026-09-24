import { useRef, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "../../utils/cn";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

/** Keyboard-accessible tab list (arrow keys move between tabs). */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            value === t.id ? "border-brand text-brand-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-xs text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
