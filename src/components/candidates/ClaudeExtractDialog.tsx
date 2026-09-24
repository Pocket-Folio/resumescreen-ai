import { useEffect, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { Candidate } from "../../../shared/types";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { formatBytes } from "../../utils/format";

/**
 * Explicit, HR-confirmed extraction of a scanned resume by Claude. Used when local OCR fails or
 * reads poorly. The original file is needed because uploaded files are not kept on the server.
 */
export function ClaudeExtractDialog({
  open,
  onClose,
  candidate,
  file: initialFile,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  candidate: Pick<Candidate, "id" | "name">;
  file?: File | null;
  onDone: (c: Candidate) => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setFile(initialFile ?? null);
  }, [open, initialFile]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const c = await api.candidates.reextract(candidate.id, file, "claude");
      onDone(c);
      toast.success("Text read by Claude", "Check the extracted text before screening.");
      onClose();
    } catch (e) {
      toast.error("Claude could not read the file", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Read this resume with Claude"
      description={`For scanned or hard-to-read files: ${candidate.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!file} onClick={run} icon={<Sparkles className="size-4" />}>
            {busy ? "Reading…" : "Send file to Claude"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-2">
        <div className="tone-blue flex items-start gap-2 rounded-lg border p-3">
          <Send className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            The <strong>original file</strong> (including any name, contact details or photo it contains) will be sent to the <strong>Claude API (Anthropic)</strong> to
            transcribe its text. Redaction settings cannot be applied to images. Use this only if local OCR could not read the file.
          </span>
        </div>
        {initialFile ? (
          <p>File: <strong>{initialFile.name}</strong> ({formatBytes(initialFile.size)})</p>
        ) : (
          <div className="space-y-1.5">
            <label className="block font-medium text-ink" htmlFor="claude-file">Choose the resume file (PDF, JPG or PNG)</label>
            <input
              id="claude-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-ink-3">Uploaded files are not stored, so please select it again.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
