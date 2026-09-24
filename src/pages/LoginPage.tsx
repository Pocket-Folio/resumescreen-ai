import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Form";

export function LoginPage({ onSuccess, serverError }: { onSuccess: () => void; serverError?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(serverError ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.auth.login(password);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="mb-3 size-12" />
          <h1 className="text-xl font-semibold">ResumeScreen AI</h1>
          <p className="mt-1 text-sm text-ink-3">Internal HR screening assistant</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
          <Field label="Access password" htmlFor="pw" error={error}>
            <Input id="pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!password} icon={<Lock className="size-4" />}>
            Sign in
          </Button>
          <p className="text-center text-xs text-ink-3">Access is restricted to authorised HR staff.</p>
        </form>
      </div>
    </div>
  );
}
