import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Form";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive,
  requireText,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact text to enable the confirm button. */
  requireText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const close = () => {
    if (busy) return;
    setTyped("");
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={close} disabled={busy}>Cancel</Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={busy}
            disabled={requireText ? typed !== requireText : false}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-2">
        <div>{message}</div>
        {children}
        {requireText && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="confirm-text">
              Type <span className="font-mono font-semibold">{requireText}</span> to confirm
            </label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        )}
      </div>
    </Modal>
  );
}
