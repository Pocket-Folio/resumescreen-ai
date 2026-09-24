import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, FileSearch, History, Pencil, RotateCcw, Trash2, FileText, AlertCircle, Sparkles, AlertTriangle } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { Modal } from "../components/ui/Modal";
import { Field, Input, Select } from "../components/ui/Form";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { AlignmentBadge, DemoBadge, ReviewStatusBadge, ScreeningStatusBadge, DecisionBadge } from "../components/StatusBadges";
import { CandidateAvatar } from "../components/candidates/CandidateTable";
import { CandidateInfoCard, ResumeProfileSections } from "../components/candidates/CandidateProfile";
import { HRReviewPanel } from "../components/candidates/HRReviewPanel";
import { ResumeTextModal } from "../components/candidates/ResumeTextModal";
import { ClaudeExtractDialog } from "../components/candidates/ClaudeExtractDialog";
import { ScreeningReport } from "../components/screening/ScreeningReport";
import { ExportButtons } from "../components/ExportButtons";
import { exportCandidateReport } from "../utils/export";
import { formatBytes, formatDate } from "../utils/format";
import type { Candidate } from "../../shared/types";

type Tab = "overview" | "report" | "resume" | "review" | "history";

export function CandidateDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const selectedScreeningId = params.get("screening");
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);

  const { data, error, loading, reload, setData } = useAsync(async () => {
    const [detail, jobs] = await Promise.all([api.candidates.get(id), api.jobProfiles.list()]);
    return { ...detail, jobs };
  }, [id]);

  const setTab = (t: Tab, screening?: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    if (screening) next.set("screening", screening);
    else if (t !== "report") next.delete("screening");
    setParams(next, { replace: true });
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState title="Candidate could not be loaded" message={error.message} onRetry={error.code === "NOT_FOUND" ? undefined : reload} />;
  if (!data) return null;

  const { candidate, screenings, jobs } = data;
  const latest = screenings[0] ?? null;
  const shown = (selectedScreeningId && screenings.find((s) => s.id === selectedScreeningId)) || latest;
  const job = jobs.find((j) => j.id === candidate.jobProfileId);
  const update = (c: Candidate) => setData((d) => ({ ...d!, candidate: c }));

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/candidates" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-3.5" /> Candidates</Link>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <CandidateAvatar name={candidate.name} className="size-10 text-sm" />
            {candidate.name}
            {candidate.isDemo && <DemoBadge />}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>{job?.title ?? latest?.jobProfileSnapshot.title ?? "No position assigned"}</span>
            <ScreeningStatusBadge value={candidate.screeningStatus} />
            <ReviewStatusBadge review={candidate.hrReview} />
            {candidate.hrReview?.decision && <DecisionBadge value={candidate.hrReview.decision} />}
            <span className="text-xs">Screened: {formatDate(latest?.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="danger-ghost" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>Delete</Button>
            <Button
              variant="primary"
              icon={<FileSearch className="size-4" />}
              disabled={!candidate.resumeText.trim()}
              title={!candidate.resumeText.trim() ? "Add resume text first" : undefined}
              onClick={() => navigate(`/screening?candidates=${candidate.id}${candidate.jobProfileId ? `&job=${candidate.jobProfileId}` : ""}`)}
            >
              {latest ? "Re-run screening" : "Run screening"}
            </Button>
          </>
        }
      />

      {candidate.extraction.status === "failed" && (
        <div className="tone-red mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm" role="alert">
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{candidate.extraction.error ?? "Text could not be extracted from this resume."}</span>
          <Button size="sm" icon={<Sparkles className="size-3.5" />} onClick={() => setClaudeOpen(true)}>Read with Claude</Button>
          <Button size="sm" onClick={() => setEditText(true)}>Paste text manually</Button>
        </div>
      )}

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={(t) => setTab(t)}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "report", label: "Screening report" },
          { id: "resume", label: "Resume text" },
          { id: "review", label: "HR review" },
          { id: "history", label: "Screening history", count: screenings.length },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2"><CandidateInfoCard candidate={candidate} latest={latest} /></div>
            <Card>
              <CardHeader title="Latest assessment" />
              <CardBody className="space-y-3">
                {latest ? (
                  <>
                    <AlignmentBadge value={latest.result.overallAssessment} />
                    <p className="text-sm text-ink-2">{latest.result.overallRationale}</p>
                    <Button size="sm" onClick={() => setTab("report")}>View full report</Button>
                  </>
                ) : (
                  <p className="text-sm text-ink-3">Not screened yet.</p>
                )}
              </CardBody>
            </Card>
          </div>
          {latest ? (
            <ResumeProfileSections record={latest} />
          ) : (
            <Card>
              <EmptyState icon={<FileSearch />} title="Profile details appear after screening" description="Resume summary, experience, education and skills are extracted by Claude when you run a screening." />
            </Card>
          )}
        </div>
      )}

      {tab === "report" &&
        (shown ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {screenings.length > 1 ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="scr-select" className="text-sm text-ink-3">Screening</label>
                  <Select id="scr-select" className="w-auto" value={shown.id} onChange={(e) => setTab("report", e.target.value)}>
                    {screenings.map((s, i) => (
                      <option key={s.id} value={s.id}>{formatDate(s.createdAt, true)} — {s.jobProfileSnapshot.title}{i === 0 ? " (latest)" : ""}</option>
                    ))}
                  </Select>
                </div>
              ) : <span />}
              <ExportButtons onExport={(f) => exportCandidateReport(f, candidate, shown, settings)} />
            </div>
            {shown.id !== latest?.id && (
              <div className="tone-blue rounded-lg border px-3 py-2 text-sm">You are viewing an earlier screening from {formatDate(shown.createdAt, true)}.</div>
            )}
            <ScreeningReport record={shown} />
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<FileSearch />}
              title="No screening results yet"
              description="Run a screening to compare this resume against a job profile."
              action={<Button variant="primary" onClick={() => navigate(`/screening?candidates=${candidate.id}${candidate.jobProfileId ? `&job=${candidate.jobProfileId}` : ""}`)}>Run screening</Button>}
            />
          </Card>
        ))}

      {tab === "resume" && (
        <Card>
          <CardHeader
            title="Resume text"
            icon={<FileText className="size-4" />}
            description={
              candidate.file
                ? `${candidate.file.name} · ${candidate.file.type === "manual" ? "pasted text" : `${candidate.file.type.toUpperCase()}, ${formatBytes(candidate.file.size)}`} · added ${formatDate(candidate.file.uploadedAt)}`
                : undefined
            }
            actions={
              <>
                <ReextractButton candidate={candidate} onDone={update} />
                <Button size="sm" icon={<Sparkles className="size-3.5" />} onClick={() => setClaudeOpen(true)}>Read with Claude</Button>
                <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditText(true)}>Edit text</Button>
              </>
            }
          />
          <CardBody className="space-y-3">
            {candidate.extraction.warnings.map((w) => (
              <div key={w} className="tone-yellow flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{w}</div>
            ))}
            {candidate.resumeText ? (
              <pre className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">{candidate.resumeText}</pre>
            ) : (
              <EmptyState title="No resume text" description="Upload the resume again or paste its text." action={<Button onClick={() => setEditText(true)}>Paste text</Button>} />
            )}
          </CardBody>
        </Card>
      )}

      {tab === "review" && (
        <div className="space-y-6">
          {latest && (
            <Card>
              <CardBody className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-ink-3">AI assessment (for reference):</span>
                <AlignmentBadge value={latest.result.overallAssessment} />
                <span className="text-ink-3">{latest.result.verificationItems.length} verification item(s), {latest.result.missingInformation.length} missing information item(s)</span>
                <button className="ml-auto text-sm font-medium text-brand-ink hover:underline" onClick={() => setTab("report")}>Review evidence</button>
              </CardBody>
            </Card>
          )}
          <HRReviewPanel key={candidate.hrReview?.updatedAt ?? "new"} candidate={candidate} onSaved={update} />
        </div>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader title="Screening history" icon={<History className="size-4" />} description="Every screening is kept. Re-running a screening adds a new entry instead of overwriting earlier results." />
          {screenings.length === 0 ? (
            <EmptyState title="No screenings yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[760px]">
                <thead>
                  <tr><th>Date</th><th>Job profile</th><th>AI assessment</th><th>Model</th><th>Prompt version</th><th>Redaction</th><th /></tr>
                </thead>
                <tbody>
                  {screenings.map((s, i) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{formatDate(s.createdAt, true)}{i === 0 && <span className="ml-2 text-xs text-ink-3">(latest)</span>}</td>
                      <td>{s.jobProfileSnapshot.title}</td>
                      <td><AlignmentBadge value={s.result.overallAssessment} /></td>
                      <td className="font-mono text-xs">{s.model}</td>
                      <td className="font-mono text-xs">{s.promptVersion}</td>
                      <td className="text-xs text-ink-3">{[s.redaction.name && "Name", s.redaction.contactInfo && "Contact"].filter(Boolean).join(", ") || "None"}</td>
                      <td className="text-right"><Button size="sm" onClick={() => setTab("report", s.id)}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ClaudeExtractDialog open={claudeOpen} onClose={() => setClaudeOpen(false)} candidate={candidate} onDone={update} />
      <EditCandidateModal open={editOpen} onClose={() => setEditOpen(false)} candidate={candidate} jobs={jobs} onSaved={(c) => { update(c); setEditOpen(false); }} />
      <ResumeTextModal
        open={editText}
        onClose={() => setEditText(false)}
        title="Edit resume text"
        description="Changes affect future screenings only. Earlier screening results are kept unchanged."
        text={candidate.resumeText}
        editable
        onSave={async (text) => {
          try {
            update(await api.candidates.update(candidate.id, { resumeText: text }));
            setEditText(false);
            toast.success("Resume text saved");
          } catch (e) {
            toast.error("Could not save text", errorMessage(e));
          }
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete candidate data?"
        destructive
        confirmLabel="Delete permanently"
        message={<>This permanently deletes <strong>{candidate.name}</strong>'s resume text, extracted details, {screenings.length} screening result(s) and HR notes. This cannot be undone.</>}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await api.candidates.remove(candidate.id);
            toast.success("Candidate data deleted");
            navigate("/candidates", { replace: true });
          } catch (e) {
            toast.error("Could not delete candidate", errorMessage(e));
          }
        }}
      />
    </>
  );
}

function ReextractButton({ candidate, onDone }: { candidate: Candidate; onDone: (c: Candidate) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex">
      <input
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
        className="peer sr-only"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onDone(await api.candidates.reextract(candidate.id, f));
            toast.success("Resume text re-extracted", f.name);
          } catch (err) {
            toast.error("Extraction failed", errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-xs font-medium shadow-xs peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--brand)] hover:bg-surface-2">
        <RotateCcw className={busy ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden /> Upload new file
      </span>
    </label>
  );
}

function EditCandidateModal({ open, onClose, candidate, jobs, onSaved }: { open: boolean; onClose: () => void; candidate: Candidate; jobs: { id: string; title: string }[]; onSaved: (c: Candidate) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", location: "", links: "", jobProfileId: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open)
      setF({ name: candidate.name, email: candidate.email, phone: candidate.phone, location: candidate.location, links: candidate.links.join("\n"), jobProfileId: candidate.jobProfileId ?? "" });
  }, [open, candidate]);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(
        await api.candidates.update(candidate.id, {
          name: f.name,
          email: f.email,
          phone: f.phone,
          location: f.location,
          links: f.links.split("\n").map((l) => l.trim()).filter(Boolean),
          jobProfileId: f.jobProfileId || null,
        }),
      );
      toast.success("Candidate updated");
    } catch (e) {
      toast.error("Could not update candidate", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit candidate" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save} disabled={!f.name.trim()}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="e-name" required><Input id="e-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Position" htmlFor="e-job">
          <Select id="e-job" value={f.jobProfileId} onChange={(e) => setF({ ...f, jobProfileId: e.target.value })}>
            <option value="">Unassigned</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </Select>
        </Field>
        <Field label="Email" htmlFor="e-email"><Input id="e-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="e-phone"><Input id="e-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Location" htmlFor="e-loc" className="sm:col-span-2"><Input id="e-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="LinkedIn / portfolio links" htmlFor="e-links" hint="One per line" className="sm:col-span-2">
          <textarea id="e-links" className="input" rows={3} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
