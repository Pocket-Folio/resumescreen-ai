import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Database, HardDrive, KeyRound, Lock, PlugZap, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Field, Input, Select, Toggle } from "../components/ui/Form";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Spinner } from "../components/ui/States";
import { MODEL_OPTIONS, type AppSettings, type Effort, type Theme } from "../../shared/types";
import { formatBytes, formatDate } from "../utils/format";

type Editable = Omit<AppSettings, "privacyNoticeAcknowledgedAt">;

export function SettingsPage() {
  const { settings, apiKey, setSettingsResponse, reloadSettings, bumpData, dataVersion } = useApp();
  const toast = useToast();
  const [form, setForm] = useState<Editable>(settings);
  const [saving, setSaving] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [wsInput, setWsInput] = useState("");
  const [wsBusy, setWsBusy] = useState(false);
  useEffect(() => setWsInput(apiKey.workspaceId ?? ""), [apiKey.workspaceId]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [confirm, setConfirm] = useState<"removeKey" | "deleteDemo" | "deleteAll" | null>(null);
  const [resetSettings, setResetSettings] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const system = useAsync(() => api.system.info(), [dataVersion]);

  // Adopt freshly loaded settings, but never overwrite edits the user hasn't saved yet.
  const baseline = useRef(settings);
  useEffect(() => {
    setForm((f) => {
      const b = baseline.current;
      const untouched = JSON.stringify({ ...f, privacyNoticeAcknowledgedAt: null }) === JSON.stringify({ ...b, privacyNoticeAcknowledgedAt: null });
      baseline.current = settings;
      return untouched ? settings : f;
    });
  }, [settings]);
  const customModel = customModelMode || !MODEL_OPTIONS.some((m) => m.id === form.model);

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify({ ...settings, privacyNoticeAcknowledgedAt: undefined }) !== JSON.stringify({ ...form, privacyNoticeAcknowledgedAt: undefined });

  const save = async () => {
    setSaving(true);
    try {
      const { privacyNoticeAcknowledgedAt: _ignored, ...payload } = { ...form, privacyNoticeAcknowledgedAt: null };
      setSettingsResponse(await api.settings.save(payload));
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Could not save settings", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async () => {
    setKeyBusy(true);
    try {
      await api.settings.saveApiKey(keyInput.trim());
      setKeyInput("");
      await reloadSettings();
      setTestResult(null);
      toast.success("API key saved", "The key is stored on the server and will not be shown again.");
    } catch (e) {
      toast.error("Could not save API key", errorMessage(e));
    } finally {
      setKeyBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.settings.testConnection(form.model);
      setTestResult({ ok: true, message: `Connected. ${r.displayName} (${r.model}) is available.` });
    } catch (e) {
      setTestResult({ ok: false, message: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      const r = await api.system.loadDemo();
      toast.success("Demo data loaded", `${r.jobProfiles} job profiles, ${r.candidates} candidates, ${r.screenings} screenings.`);
      bumpData();
    } catch (e) {
      toast.error("Could not load demo data", errorMessage(e));
    } finally {
      setDemoBusy(false);
    }
  };

  const envKey = apiKey.source === "environment";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure the Claude API, privacy, exports and local data."
        actions={<Button variant="primary" icon={<Save className="size-4" />} loading={saving} disabled={!dirty} onClick={save}>Save settings</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title="Claude API" icon={<KeyRound className="size-4" />} description="The API key is stored on the server only. It is never sent to the browser and cannot be viewed after saving." />
          <CardBody className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-3">Status:</span>
                {apiKey.configured ? <Badge tone="green" icon={<CheckCircle2 className="size-3" />}>Configured</Badge> : <Badge tone="yellow">Not configured</Badge>}
                {apiKey.masked && <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{apiKey.masked}</code>}
                {envKey && <Badge tone="gray">Set by server environment</Badge>}
              </div>
              {envKey ? (
                <p className="text-sm text-ink-3">The key comes from the <code>ANTHROPIC_API_KEY</code> environment variable. Change it in the server's <code>.env</code> file and restart the application.</p>
              ) : (
                <Field label={apiKey.configured ? "Replace API key" : "API key"} htmlFor="api-key" hint="Starts with “sk-ant-”. Create one in the Claude Console.">
                  <div className="flex gap-2">
                    <Input id="api-key" type="password" autoComplete="off" spellCheck={false} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="sk-ant-…" />
                    <Button variant="primary" onClick={saveKey} loading={keyBusy} disabled={!keyInput.trim()}>Save</Button>
                  </div>
                </Field>
              )}
              <Field
                label="Workspace ID (optional)"
                htmlFor="ws-id"
                hint={
                  apiKey.workspaceSource === "environment"
                    ? "Set by the ANTHROPIC_WORKSPACE_ID environment variable."
                    : "Only needed if your API key is not tied to a workspace. Find it in the Claude Console under Settings → Workspaces."
                }
              >
                <div className="flex gap-2">
                  <Input id="ws-id" value={wsInput} onChange={(e) => setWsInput(e.target.value)} placeholder="wrkspc_…" spellCheck={false} disabled={apiKey.workspaceSource === "environment"} />
                  <Button
                    loading={wsBusy}
                    disabled={apiKey.workspaceSource === "environment" || wsInput.trim() === (apiKey.workspaceId ?? "")}
                    onClick={async () => {
                      setWsBusy(true);
                      try {
                        await api.settings.saveWorkspaceId(wsInput.trim());
                        await reloadSettings();
                        setTestResult(null);
                        toast.success(wsInput.trim() ? "Workspace ID saved" : "Workspace ID removed");
                      } catch (e) {
                        toast.error("Could not save Workspace ID", errorMessage(e));
                      } finally {
                        setWsBusy(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button icon={<PlugZap className="size-4" />} loading={testing} disabled={!apiKey.configured} onClick={test}>Test connection</Button>
                {apiKey.source === "settings" && <Button variant="danger-ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirm("removeKey")}>Remove key</Button>}
              </div>
              {testResult && (
                <div className={`${testResult.ok ? "tone-green" : "tone-red"} flex items-start gap-2 rounded-lg border px-3 py-2 text-sm`} role="status">
                  {testResult.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                  {testResult.message}
                </div>
              )}
              <p className="text-xs text-ink-3">Test connection checks the key and model availability. It sends no candidate data.</p>
            </div>
            <div className="space-y-4">
              <Field label="Screening model" htmlFor="model" hint={MODEL_OPTIONS.find((m) => m.id === form.model)?.note}>
                {customModel ? (
                  <Input id="model" value={form.model} onChange={(e) => set("model", e.target.value.trim())} placeholder="claude-…" />
                ) : (
                  <Select id="model" value={form.model} onChange={(e) => set("model", e.target.value)}>
                    {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                )}
              </Field>
              <button
                type="button"
                className="text-xs text-brand-ink underline"
                onClick={() => {
                  if (customModel) {
                    setCustomModelMode(false);
                    if (!MODEL_OPTIONS.some((m) => m.id === form.model)) set("model", MODEL_OPTIONS[0].id);
                  } else setCustomModelMode(true);
                }}
              >{customModel ? "Choose from list" : "Enter a model ID manually"}</button>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Maximum tokens" htmlFor="max-tokens" hint="4,000 – 64,000">
                  <Input id="max-tokens" type="number" min={4000} max={64000} step={1000} value={form.maxTokens} onChange={(e) => set("maxTokens", Number(e.target.value))} />
                </Field>
                <Field label="Effort" htmlFor="effort" hint="Higher effort is more thorough but slower.">
                  <Select id="effort" value={form.effort} onChange={(e) => set("effort", e.target.value as Effort)} disabled={form.model.startsWith("claude-haiku")}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </Field>
              </div>
              <Field label="Temperature" htmlFor="temp" hint="Not supported by current Claude models — they use Effort instead, so this setting is unavailable.">
                <Input id="temp" value="Unavailable" disabled />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Privacy" icon={<ShieldCheck className="size-4" />} description="Controls what is sent to Claude when a screening runs." />
          <CardBody className="space-y-5">
            <Toggle checked={form.redactName} onChange={(v) => set("redactName", v)} label="Remove candidate name before sending" description="Replaces the name with [CANDIDATE] to reduce name-based bias." />
            <Toggle checked={form.redactContactInfo} onChange={(v) => set("redactContactInfo", v)} label="Remove contact details before sending" description="Removes email addresses, phone numbers and URLs. Contact details are extracted locally instead." />
            <Toggle checked={form.showPrivacyNoticeEveryTime} onChange={(v) => set("showPrivacyNoticeEveryTime", v)} label="Show the privacy notice before every screening" description={settings.privacyNoticeAcknowledgedAt ? `Notice first acknowledged ${formatDate(settings.privacyNoticeAcknowledgedAt, true)}.` : "The notice will be shown before the first screening."} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Application" description="Appearance and export defaults." />
          <CardBody className="space-y-5">
            <Field label="Theme" htmlFor="theme">
              <Select id="theme" value={form.theme} onChange={(e) => set("theme", e.target.value as Theme)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Match system</option>
              </Select>
            </Field>
            <Toggle checked={form.exportIncludeHrNotes} onChange={(v) => set("exportIncludeHrNotes", v)} label="Include HR notes in exports" />
            <Toggle checked={form.exportIncludeResumeText} onChange={(v) => set("exportIncludeResumeText", v)} label="Include full resume text in candidate reports" description="Off by default to keep exported files smaller and less sensitive." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data storage" icon={<HardDrive className="size-4" />} />
          <CardBody className="space-y-3 text-sm">
            {!system.data ? (
              <Spinner />
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-ink-3">Database</dt><dd className="font-mono text-xs break-all">{system.data.databaseFile}</dd>
                  <dt className="text-ink-3">Size</dt><dd>{formatBytes(system.data.databaseSizeBytes)}</dd>
                  <dt className="text-ink-3">Records</dt>
                  <dd>{system.data.counts.jobProfiles} job profiles · {system.data.counts.candidates} candidates · {system.data.counts.screenings} screenings · {system.data.counts.auditEvents} audit events</dd>
                  <dt className="text-ink-3">Access control</dt>
                  <dd className="flex items-center gap-1.5">{system.data.authEnabled ? <><Lock className="size-3.5" /> Password protected</> : <Badge tone="yellow">Disabled</Badge>}</dd>
                  <dt className="text-ink-3">Version</dt><dd>{system.data.version} · prompt {system.data.promptVersion}</dd>
                </dl>
                <p className="text-xs text-ink-3">All candidate data lives in this SQLite database on the server (in Docker, the <code>/app/data</code> volume). Uploaded files are not kept — only their extracted text.</p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data management" icon={<Database className="size-4" />} />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Demo data</div>
                <p className="text-xs text-ink-3">2 job profiles, 5 fictional candidates, sample screenings and HR notes.{system.data ? ` ${system.data.counts.demoRecords} demo records present.` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={demoBusy} onClick={loadDemo}>Load demo data</Button>
                <Button size="sm" variant="danger-ghost" disabled={!system.data?.counts.demoRecords} onClick={() => setConfirm("deleteDemo")}>Delete demo data</Button>
              </div>
            </div>
            <div className="tone-red flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">Delete all local data</div>
                <p className="text-xs">Permanently deletes all job profiles, candidates, resume text, screenings, HR notes and the audit log.</p>
              </div>
              <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirm("deleteAll")}>Delete all data</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm === "removeKey"}
        title="Remove API key?"
        destructive
        confirmLabel="Remove key"
        message="Screenings will not run until a new key is saved."
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await api.settings.removeApiKey();
            await reloadSettings();
            toast.success("API key removed");
          } catch (e) {
            toast.error("Could not remove key", errorMessage(e));
          }
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "deleteDemo"}
        title="Delete demo data?"
        destructive
        confirmLabel="Delete demo data"
        message="Removes the demo job profiles, candidates and their screenings. Your own data is not affected."
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await api.system.deleteDemo();
            bumpData();
            toast.success("Demo data deleted");
          } catch (e) {
            toast.error("Could not delete demo data", errorMessage(e));
          }
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "deleteAll"}
        title="Delete all local data?"
        destructive
        requireText="DELETE"
        confirmLabel="Delete everything"
        message="This permanently deletes every job profile, candidate, resume, screening result, HR note and audit entry stored by ResumeScreen AI. It cannot be undone. Export anything you need first."
        onClose={() => {
          setConfirm(null);
          setResetSettings(false);
        }}
        onConfirm={async () => {
          try {
            await api.system.deleteAll(resetSettings);
            await reloadSettings();
            bumpData();
            toast.success("All local data deleted");
          } catch (e) {
            toast.error("Could not delete data", errorMessage(e));
          }
          setConfirm(null);
          setResetSettings(false);
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[var(--danger)]" checked={resetSettings} onChange={(e) => setResetSettings(e.target.checked)} />
          Also reset settings and remove the saved API key
        </label>
      </ConfirmDialog>
    </>
  );
}
