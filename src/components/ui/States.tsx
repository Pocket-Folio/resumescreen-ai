import { useState, type ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 rounded-full bg-surface-2 p-3 text-ink-3 [&_svg]:size-6">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, detail, onRetry }: { title?: string; message: string; detail?: string; onRetry?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div role="alert" className="tone-red rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm">{message}</p>
          {detail && (
            <button onClick={() => setShow((s) => !s)} className="mt-2 text-xs underline underline-offset-2">
              {show ? "Hide technical details" : "Show technical details"}
            </button>
          )}
          {show && detail && <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap">{detail}</pre>}
        </div>
        {onRetry && (
          <Button size="sm" onClick={onRetry} icon={<RefreshCw className="size-3.5" />}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-md bg-surface-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent dark:before:via-white/5", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm text-ink-3", className)} role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label ?? "Loading…"}
    </div>
  );
}
