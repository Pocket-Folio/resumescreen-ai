import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./ui/Button";
import { useToast } from "../context/ToastContext";
import type { ExportFormat } from "../utils/export";

export function ExportButtons({ onExport, disabled, size = "sm" }: { onExport: (f: ExportFormat) => Promise<void> | void; disabled?: boolean; size?: "sm" | "md" }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const toast = useToast();
  const run = async (f: ExportFormat) => {
    setBusy(f);
    try {
      await onExport(f);
    } catch {
      toast.error("Export failed", "The report could not be generated. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Export">
      <Download className="mr-1 size-4 text-ink-3" aria-hidden />
      {(["pdf", "csv", "json"] as ExportFormat[]).map((f) => (
        <Button key={f} size={size} onClick={() => run(f)} loading={busy === f} disabled={disabled || (busy !== null && busy !== f)}>
          {f.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
