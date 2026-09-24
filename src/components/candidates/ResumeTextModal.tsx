import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Form";

/** View or edit extracted resume text; also used to paste text manually when extraction fails. */
export function ResumeTextModal({
  open,
  onClose,
  title,
  text,
  editable,
  askName,
  initialName = "",
  onSave,
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  editable?: boolean;
  askName?: boolean;
  initialName?: string;
  description?: string;
  onSave?: (text: string, name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(text);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setValue(text);
      setName(initialName);
    }
  }, [open, text, initialName]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
      footer={
        editable ? (
          <>
            <span className="mr-auto self-center text-xs text-ink-3">{value.length.toLocaleString()} characters</span>
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!value.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave?.(value, name);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save text
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {editable ? (
        <div className="space-y-4">
          {askName && (
            <Field label="Candidate name" htmlFor="manual-name" hint="Optional — detected from the text if left empty.">
              <Input id="manual-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label="Resume text" htmlFor="manual-text">
            <Textarea id="manual-text" rows={18} value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-xs" placeholder="Paste the full resume text here…" />
          </Field>
        </div>
      ) : text ? (
        <pre className="rounded-lg border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">{text}</pre>
      ) : (
        <p className="text-sm text-ink-3">No text available.</p>
      )}
    </Modal>
  );
}
