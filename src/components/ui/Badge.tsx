import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type Tone = "green" | "yellow" | "red" | "gray" | "blue" | "purple" | "indigo";

export function Badge({ tone = "gray", children, icon, className, title }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        `tone-${tone}`,
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
