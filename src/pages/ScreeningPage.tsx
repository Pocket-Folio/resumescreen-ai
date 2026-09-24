import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, CheckCircle2, CircleSlash, Eye, FileSearch, KeyRound, Loader2, Play, Send, Square, XCircle } from "lucide-react";
import { api, ApiError, errorMessage, runScreening } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Checkbox, Field, Input, Select } from "../components/ui/Form";
import { Modal } from "../components/ui/Modal";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { AlignmentBadge, ImportanceBadge, ScreeningStatusBadge } from "../components/StatusBadges";
import { ScreeningProgress } from "../components/screening/ScreeningProgress";
import { PrivacyNoticeModal } from "../components/screening/PrivacyNoticeModal";
import { UploadJobDescriptionButton } from "../components/jobs/JobDescriptionTools";
import { criteriaByImportance } from "../../shared/screeningUtils";
import { MODEL_OPTIONS, type Importance, type ScreeningRecord, type ScreeningStage } from "../../shared/types";
import { formatDate } from "../utils/format";

type RunStatus = "pending" | "running" | "done" | "failed" | "cancelled";
interface Run {
  candidateId: string;
  name: string;
  status: RunStatus;
  stage: ScreeningStage | null;
  error?: ApiError;
  screening?: ScreeningRecord;
}

export function ScreeningPage() {
  const { settings, apiKey, setSettingsResponse, dataVersion } = useApp();
  const toast = useToast();
  const [params] = useSearchParams();
  const [jobId, setJobId] = useState(params.get("job") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set((params.get("candidates") ?? "").split(",").filter(Boolean)));
  const [search, setSearch] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);

  const { data, error, loading, reload } = useAsync(async () => {
    const [jobs, candidates] = await Promise.all([api.jobProfiles.list(), api.candidates.list()]);
    return { jobs, candidates };
  }, [dataVersion]);
  const prompt = useAsync(() => api.screenings.prompt(), []);

  // Once, after loading: drop an unknown ?job= id, then default from the selected candidates or the only active profile.
  const defaulted = useRef(false);
  useEffect(() => {
    if (!data || defaulted.current) return;
    defaulted.current = true;
    if (jobId && data.jobs.some((j) => j.id === jobId)) return;
    const fromCandidate = data.candidates.find((c) => selected.has(c.id) && c.jobProfileId)?.jobProfileId;
    const active = data.jobs.filter((j) => j.status === "active");
    setJobId(fromCandidate ?? (active.length === 1 ? active[0].id : ""));
  }, [data, jobId, selected]);

  // Abort an in-flight screening if the user leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const job = data?.jobs.find((j) => j.id === jobId) ?? null;
  const grouped = job ? criteriaByImportance(job) : null;
  const pool = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.candidates.filter((c) => (!q || `${c.name} ${c.jobTitle ?? ""}`.toLowerCase().includes(q)) && (!jobId || !c.jobProfileId || c.jobProfileId === jobId || selected.has(c.id)));
  }, [data, search, jobId, selected]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const chosen = data.candidates.filter((c) => selected.has(c.id));
  const noText = chosen.filter((c) => c.extraction.status === "failed");
  const runnable = chosen.length - noText.length;
  const canRun = Boolean(job && runnable > 0 && apiKey.configured && !running && job.criteria.length);
  const modelLabel = MODEL_OPTIONS.find((m) => m.id === settings.model)?.label ?? settings.model;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const start = () => {
    if (!settings.privacyNoticeAcknowledgedAt || settings.showPrivacyNoticeEveryTime) setPrivacyOpen(true);
    else void execute();
  };

  const execute = async () => {
    if (!job) return;
    const queue = chosen.filter((c) => c.extraction.status !== "failed");
    const initial: Run[] = queue.map((c) => ({ candidateId: c.id, name: c.name, status: "pending", stage: null }));
    setRuns(initial);
    setRunning(true);
    stopRef.current = false;
    const patch = (id: string, p: Partial<Run>) => setRuns((rs) => rs.map((r) => (r.candidateId === id ? { ...r, ...p } : r)));

    let ok = 0;
    for (const c of queue) {
      if (stopRef.current) {
        patch(c.id, { status: "cancelled" });
        continue;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      patch(c.id, { status: "running", stage: "reading_resume" });
      try {
        const res = await runScreening(c.id, job.id, (stage) => patch(c.id, { stage }), controller.signal);
        patch(c.id, { status: "done", screening: res.screening });
        ok++;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("INTERNAL", "Unexpected error.", 0);
        patch(c.id, { status: err.code === "CANCELLED" ? "cancelled" : "failed", error: err });
        // Configuration problems will fail every remaining candidate the same way.
        if (["NOT_CONFIGURED", "AUTH_FAILED"].includes(err.code)) stopRef.current = true;
      }
    }
    abortRef.current = null;
    setRunning(false);
    reload();
    if (ok) toast.success(`Screening complete for ${ok} candidate${ok === 1 ? "" : "s"}`, "Review the evidence before recording an HR decision.");
  };

  const saveDescription = async (text: string) => {
    if (!job) return;
    const { id: _id, createdAt: _c, updatedAt: _u, isDemo: _d, ...input } = job;
    try {
      await api.jobProfiles.update(job.id, { ...input, description: text });
      toast.success("Job description saved to the profile", "It will be included in every screening for this job.");
      reload();
    } catch (e) {
      toast.error("Could not save the job description", errorMessage(e));
    }
  };

  const cancel = () => {
    stopRef.current = true;
    abortRef.current?.abort();
  };

  const current = runs.find((r) => r.status === "running");
  const finished = runs.length > 0 && !running;

  return (
    <>
      <PageHeader title="Screening" description="Review the screening configuration, then run an AI-assisted comparison of each resume against the job profile." />

      {!apiKey.configured && (
        <div className="tone-yellow mb-6 flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
          <KeyRound className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">The Claude API key is not configured, so screenings cannot run yet. You can still explore demo results.</span>
          <Link to="/settings"><Button size="sm">Open settings</Button></Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="1. Job profile" />
            <CardBody>
              {data.jobs.length === 0 ? (
                <EmptyState title="No job profiles" description="Create a job profile first." action={<Link to="/job-profiles/new"><Button variant="primary">Create job profile</Button></Link>} className="py-6" />
              ) : (
                <Field label="Screen against" htmlFor="job-select">
                  <Select id="job-select" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={running}>
                    <option value="">Select a job profile…</option>
                    {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.status === "archived" ? " (archived)" : ""}</option>)}
                  </Select>
                </Field>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="2. Candidates"
              description={`${chosen.length} selected`}
              actions={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter…" className="w-48" aria-label="Filter candidates" />}
            />
            {pool.length === 0 ? (
              <EmptyState title="No candidates available" description="Upload resumes first." action={<Link to="/candidates/upload"><Button>Upload resumes</Button></Link>} className="py-8" />
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <Checkbox
                          label="Select all"
                          disabled={running}
                          checked={pool.length > 0 && pool.every((c) => selected.has(c.id))}
                          onChange={(v) =>
                            setSelected((s) => {
                              const n = new Set(s);
                              for (const c of pool) {
                                if (v) n.add(c.id);
                                else n.delete(c.id);
                              }
                              return n;
                            })
                          }
                        />
                      </th>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Last screened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-2/60">
                        <td><Checkbox label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={running} /></td>
                        <td>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-ink-3">{c.jobTitle ?? "Unassigned"}</div>
                        </td>
                        <td>
                          {c.extraction.status === "failed" ? <Badge tone="red">No resume text</Badge> : <ScreeningStatusBadge value={c.screeningStatus} />}
                        </td>
                        <td className="text-ink-2">{c.latest ? formatDate(c.latest.createdAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {noText.length > 0 && (
              <p className="border-t border-line px-5 py-3 text-xs text-[var(--red-fg)]">{noText.length} selected candidate(s) have no resume text and will be skipped.</p>
            )}
          </Card>

          {runs.length > 0 && (
            <Card>
              <CardHeader
                title={running ? "Screening in progress" : "Screening results"}
                actions={running && <Button variant="danger-ghost" size="sm" icon={<Square className="size-3.5" />} onClick={cancel}>Cancel</Button>}
              />
              <ul className="divide-y divide-line">
                {runs.map((r) => (
                  <li key={r.candidateId} className="flex flex-wrap items-start gap-3 px-5 py-3">
                    <span className="mt-0.5">
                      {r.status === "pending" && <Loader2 className="size-4 text-ink-3" aria-label="Waiting" />}
                      {r.status === "running" && <Loader2 className="size-4 animate-spin text-brand" aria-label="Running" />}
                      {r.status === "done" && <CheckCircle2 className="size-4 text-[var(--green-fg)]" aria-label="Done" />}
                      {r.status === "failed" && <XCircle className="size-4 text-[var(--red-fg)]" aria-label="Failed" />}
                      {r.status === "cancelled" && <CircleSlash className="size-4 text-ink-3" aria-label="Cancelled" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{r.name}</div>
                      {r.status === "pending" && <div className="text-xs text-ink-3">Waiting…</div>}
                      {r.status === "cancelled" && <div className="text-xs text-ink-3">Cancelled — candidate information unchanged.</div>}
                      {r.error && r.status === "failed" && (
                        <div className="mt-1 text-sm text-[var(--red-fg)]">
                          {r.error.message}
                          {r.error.detail && <div className="mt-0.5 text-xs opacity-80">Details: {r.error.detail}</div>}
                        </div>
                      )}
                    </div>
                    {r.screening && (
                      <div className="flex items-center gap-2">
                        <AlignmentBadge value={r.screening.result.overallAssessment} />
                        <Link to={`/candidates/${r.candidateId}?tab=report`}><Button size="sm" icon={<Eye className="size-3.5" />}>View report</Button></Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {finished && runs.some((r) => r.status === "failed") && (
                <div className="border-t border-line px-5 py-3">
                  <Button size="sm" onClick={() => {
                    setSelected(new Set(runs.filter((r) => r.status !== "done").map((r) => r.candidateId)));
                    setRuns([]);
                  }}>Retry failed</Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-20">
            <CardHeader title="Screening configuration" description="Review before running." />
            <CardBody className="space-y-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Job profile</dt><dd className="text-right font-medium">{job?.title ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Candidates</dt><dd className="font-medium">{chosen.length - noText.length}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Screening model</dt><dd className="font-medium">{modelLabel}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Prompt version</dt><dd className="font-mono text-xs">{prompt.data?.version ?? "…"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Redaction before sending</dt><dd className="text-right">{[settings.redactName && "Name", settings.redactContactInfo && "Contact details"].filter(Boolean).join(", ") || "None"}</dd></div>
              </dl>

              {grouped && (
                <div className="space-y-3 border-t border-line pt-4">
                  {(["required", "important", "preferred"] as Importance[]).map((imp) => (
                    <div key={imp}>
                      <div className="mb-1.5 flex items-center gap-2"><ImportanceBadge value={imp} /><span className="text-xs text-ink-3">{grouped[imp].length} criteria</span></div>
                      {grouped[imp].length === 0 ? (
                        <p className="text-xs text-ink-3">None</p>
                      ) : (
                        <ul className="space-y-1">
                          {grouped[imp].map((c) => (
                            <li key={c.id} className="text-sm"><span className="font-medium">{c.criterion}</span>{c.requirement && <span className="text-ink-3"> — {c.requirement}</span>}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {job && job.criteria.length === 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-[var(--yellow-fg)]"><AlertTriangle className="size-3.5" /> This profile has no criteria. <Link className="underline" to={`/job-profiles/${job.id}`}>Add criteria</Link></p>
                  )}
                </div>
              )}

              {job && (
                <div className="border-t border-line pt-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-3">Job description</span>
                    <UploadJobDescriptionButton label={job.description.trim() ? "Replace" : "Upload job description"} onText={saveDescription} />
                  </div>
                  {job.description.trim() ? (
                    <>
                      <p className={descOpen ? "text-sm whitespace-pre-wrap text-ink-2" : "line-clamp-4 text-sm whitespace-pre-wrap text-ink-2"}>{job.description}</p>
                      {job.description.length > 240 && (
                        <button type="button" className="mt-1 text-sm font-medium text-brand-ink hover:underline" onClick={() => setDescOpen((o) => !o)}>{descOpen ? "Show less" : "Show full description"}</button>
                      )}
                    </>
                  ) : (
                    <p className="flex items-start gap-1.5 text-xs text-[var(--yellow-fg)]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> No job description. Upload one so Claude has the full role context.</p>
                  )}
                </div>
              )}

              <div className="border-t border-line pt-4">
                <div className="mb-1 text-xs font-medium text-ink-3">Screening instructions</div>
                <p className="text-sm text-ink-2">{job?.screeningInstructions || "No job-specific instructions."}</p>
                <button className="mt-2 text-sm font-medium text-brand-ink hover:underline" onClick={() => setPromptOpen(true)}>View standard screening instructions</button>
              </div>

              <div className="tone-blue flex items-start gap-2 rounded-lg border p-3 text-xs">
                <Send className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>Running a screening sends each selected resume's text and this job profile to the <strong>Claude API (Anthropic)</strong>. Nothing is sent until you click Run.</span>
              </div>

              {current && (
                <div className="rounded-lg border border-line p-3">
                  <div className="mb-2 text-sm font-medium">Screening {current.name}</div>
                  <ScreeningProgress stage={current.stage} />
                </div>
              )}

              <Button variant="primary" size="lg" className="w-full" disabled={!canRun} loading={running} icon={<Play className="size-4" />} onClick={start}>
                {running ? "Screening…" : `Run Screening${runnable > 1 ? ` (${runnable})` : ""}`}
              </Button>
              {!running && !canRun && (
                <p className="text-center text-xs text-ink-3">
                  {!apiKey.configured
                    ? "Configure the Claude API key in Settings."
                    : !job
                      ? "Select a job profile."
                      : job.criteria.length === 0
                        ? "Add screening criteria to this job profile."
                        : chosen.length === 0
                          ? "Select at least one candidate."
                          : runnable === 0
                            ? "The selected candidates have no resume text yet."
                            : ""}
                </p>
              )}
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-3"><FileSearch className="size-3.5" /> Results are AI-generated and require HR review.</p>
            </CardBody>
          </Card>
        </div>
      </div>

      <PrivacyNoticeModal
        open={privacyOpen}
        redactName={settings.redactName}
        redactContact={settings.redactContactInfo}
        onClose={() => setPrivacyOpen(false)}
        onAccept={async () => {
          setPrivacyOpen(false);
          try {
            if (!settings.privacyNoticeAcknowledgedAt) setSettingsResponse(await api.settings.acknowledgePrivacy());
          } catch {
            /* acknowledgement is best-effort; screening proceeds */
          }
          void execute();
        }}
      />
      <Modal open={promptOpen} onClose={() => setPromptOpen(false)} title="Standard screening instructions" description={`Sent to Claude with every screening · ${prompt.data?.version ?? ""}`} size="xl">
        <pre className="rounded-lg border border-line bg-surface-2 p-4 text-xs leading-relaxed whitespace-pre-wrap text-ink-2">{prompt.data?.systemPrompt ?? "Loading…"}</pre>
      </Modal>
    </>
  );
}
