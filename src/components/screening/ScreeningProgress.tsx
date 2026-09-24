import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { ScreeningStage } from "../../../shared/types";
import { STAGES } from "../../utils/labels";
import { cn } from "../../utils/cn";

/** Step list driven by real progress events streamed from the server. */
export function ScreeningProgress({ stage }: { stage: ScreeningStage | null }) {
  const current = stage ? STAGES.findIndex((s) => s.id === stage) : -1;
  return (
    <ol className="space-y-2.5" aria-label="Screening progress">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className={cn("flex items-center gap-2.5 text-sm", done ? "text-ink" : active ? "font-medium text-ink" : "text-ink-3")} aria-current={active ? "step" : undefined}>
            {done ? (
              <CheckCircle2 className="size-4 text-[var(--green-fg)]" aria-hidden />
            ) : active ? (
              <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
            ) : (
              <Circle className="size-4" aria-hidden />
            )}
            {s.label}
            <span className="sr-only">{done ? "(done)" : active ? "(in progress)" : "(pending)"}</span>
          </li>
        );
      })}
    </ol>
  );
}
