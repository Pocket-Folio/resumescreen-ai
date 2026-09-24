import { useState } from "react";
import { Link } from "react-router";
import { Activity, Briefcase, FileText, History } from "lucide-react";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Select } from "../components/ui/Form";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { ExportButtons } from "../components/ExportButtons";
import { AlignmentBadge } from "../components/StatusBadges";
import { Badge } from "../components/ui/Badge";
import { exportActivityReport, exportCandidateReport, exportJobSummary } from "../utils/export";
import { formatDate } from "../utils/format";

export function ReportsPage() {
  const { settings, dataVersion } = useApp();
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, error, loading, reload } = useAsync(async () => {
    const [candidates, jobs, screenings, audit] = await Promise.all([api.candidates.list(), api.jobProfiles.list(), api.screenings.list(), api.system.audit(1000)]);
    return { candidates, jobs, screenings, audit };
  }, [dataVersion]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const names = new Map(data.candidates.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Reports" description="Generate and export reports. Every report clearly separates AI-generated assessments from HR-entered information." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader title="Candidate screening report" icon={<FileText className="size-4" />} description="Full assessment, evidence and HR review for one candidate (latest screening)." />
          <CardBody className="flex flex-1 flex-col gap-4">
            <Field label="Candidate" htmlFor="rep-cand">
              <Select id="rep-cand" value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
                <option value="">Select a candidate…</option>
                {data.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}{c.latest ? "" : " (not screened)"}</option>)}
              </Select>
            </Field>
            <div className="mt-auto">
              <ExportButtons
                disabled={!candidateId}
                onExport={async (f) => {
                  const d = await api.candidates.get(candidateId);
                  await exportCandidateReport(f, d.candidate, d.screenings[0] ?? null, settings);
                }}
              />
            </div>
          </CardBody>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Job screening summary" icon={<Briefcase className="size-4" />} description="All candidates for a job profile with AI alignment and HR review status (alphabetical, not ranked)." />
          <CardBody className="flex flex-1 flex-col gap-4">
            <Field label="Job profile" htmlFor="rep-job">
              <Select id="rep-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">Select a job profile…</option>
                {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </Field>
            <div className="mt-auto">
              <ExportButtons disabled={!jobId} onExport={(f) => exportJobSummary(f, data.jobs.find((j) => j.id === jobId)!, data.candidates)} />
            </div>
          </CardBody>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Screening activity report" icon={<Activity className="size-4" />} description="Screenings performed and the audit log for a date range." />
          <CardBody className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="rep-from"><Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To" htmlFor="rep-to"><Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
            <div className="mt-auto">
              <ExportButtons onExport={(f) => exportActivityReport(f, data.audit, data.screenings, { from, to }, names)} />
            </div>
          </CardBody>
        </Card>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Export options (include resume text: {settings.exportIncludeResumeText ? "yes" : "no"}, include HR notes: {settings.exportIncludeHrNotes ? "yes" : "no"}) can be changed in <Link className="underline" to="/settings">Settings</Link>. Exports contain personal information — store and share them securely.
      </p>

      <Card className="mt-6">
        <CardHeader title="Screening history" icon={<History className="size-4" />} description="All screenings across candidates, newest first." />
        {data.screenings.length === 0 ? (
          <EmptyState title="No screenings yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead><tr><th>Date</th><th>Candidate</th><th>Job profile</th><th>AI assessment</th><th>Model</th><th>Prompt version</th><th /></tr></thead>
              <tbody>
                {data.screenings.slice(0, 100).map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">{formatDate(s.createdAt, true)}</td>
                    <td>{names.get(s.candidateId) ?? "—"} {s.isDemo && <Badge tone="yellow" className="ml-1">Demo</Badge>}</td>
                    <td>{s.jobProfileSnapshot.title}</td>
                    <td><AlignmentBadge value={s.result.overallAssessment} /></td>
                    <td className="font-mono text-xs">{s.model}</td>
                    <td className="font-mono text-xs">{s.promptVersion}</td>
                    <td className="text-right"><Link className="text-sm font-medium text-brand-ink hover:underline" to={`/candidates/${s.candidateId}?tab=report&screening=${s.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Audit log" description="Recent activity. Entries never contain resume content." />
        {data.audit.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="table-base min-w-[700px]">
              <thead><tr><th>Date</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>
                {data.audit.slice(0, 200).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-ink-2">{formatDate(e.at, true)}</td>
                    <td className="font-mono text-xs">{e.action}</td>
                    <td className="text-ink-2">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
