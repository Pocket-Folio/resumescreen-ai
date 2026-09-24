import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Database, FileSearch, Hourglass, Upload, Users, Briefcase } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { CandidateTable } from "../components/candidates/CandidateTable";
import { AlignmentBadge } from "../components/StatusBadges";
import type { OverallAssessment } from "../../shared/screeningSchema";

function Stat({ label, value, icon, hint, to }: { label: string; value: number; icon: React.ReactNode; hint: string; to: string }) {
  return (
    <Link to={to} className="group rounded-xl border border-line bg-surface p-4 shadow-xs transition hover:border-line-strong hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        <span className="rounded-lg bg-surface-2 p-1.5 text-ink-3 group-hover:text-brand-ink [&_svg]:size-4">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{hint}</div>
    </Link>
  );
}

export function DashboardPage() {
  const { dataVersion, bumpData } = useApp();
  const toast = useToast();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { data, error, loading, reload } = useAsync(
    async () => {
      const [candidates, jobs, system] = await Promise.all([api.candidates.list(), api.jobProfiles.list(), api.system.info()]);
      return { candidates, jobs, system };
    },
    [dataVersion],
  );

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const r = await api.system.loadDemo();
      toast.success("Demo data loaded", `${r.jobProfiles} job profiles and ${r.candidates} sample candidates were added.`);
      bumpData();
    } catch (e) {
      toast.error("Could not load demo data", errorMessage(e));
    } finally {
      setLoadingDemo(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState title="Dashboard could not be loaded" message={error.message} onRetry={reload} />;
  if (!data) return null;

  const { candidates, jobs, system } = data;
  const screened = candidates.filter((c) => c.latest);
  const awaiting = screened.filter((c) => c.hrReview?.status !== "completed");
  const flagged = candidates.filter((c) => c.screeningStatus === "needs_review");
  const alignmentCounts = screened.reduce<Record<string, number>>((acc, c) => {
    acc[c.latest!.overallAssessment] = (acc[c.latest!.overallAssessment] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of candidates, AI-assisted screenings and HR review progress."
        actions={
          <>
            <Link to="/candidates/upload"><Button icon={<Upload className="size-4" />}>Upload resumes</Button></Link>
            <Link to="/screening"><Button variant="primary" icon={<FileSearch className="size-4" />}>Run screening</Button></Link>
          </>
        }
      />

      {candidates.length === 0 && jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="Welcome to ResumeScreen AI"
            description="Start by creating a job profile and uploading resumes — or load the demo data to explore the application with sample candidates and screening results."
            action={
              <>
                <Button variant="primary" loading={loadingDemo} onClick={loadDemo} icon={<Database className="size-4" />}>Load demo data</Button>
                <Link to="/job-profiles/new"><Button icon={<Briefcase className="size-4" />}>Create job profile</Button></Link>
              </>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="Total candidates" value={candidates.length} icon={<Users />} hint={`${jobs.length} job profile${jobs.length === 1 ? "" : "s"}`} to="/candidates" />
            <Stat label="Candidates screened" value={screened.length} icon={<CheckCircle2 />} hint={`${candidates.length - screened.length} not yet screened`} to="/candidates?filter=screened" />
            <Stat label="Awaiting review" value={awaiting.length} icon={<Hourglass />} hint="Screened, HR review not complete" to="/candidates?filter=awaiting_review" />
            <Stat label="Flagged for review" value={flagged.length} icon={<AlertTriangle />} hint="Items need verification" to="/candidates?filter=needs_verification" />
            <Stat label="Completed screenings" value={system.counts.screenings} icon={<ClipboardCheck />} hint="Including screening history" to="/reports" />
          </div>

          {screened.length > 0 && (
            <Card>
              <CardHeader title="Resume alignment overview" description="Distribution of AI-generated alignment labels for the latest screening of each candidate. This is not a hiring recommendation." />
              <div className="flex flex-wrap gap-3 px-5 py-4">
                {(["strong_alignment", "moderate_alignment", "limited_alignment", "insufficient_information"] as OverallAssessment[]).map((k) => (
                  <div key={k} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                    <AlignmentBadge value={k} />
                    <span className="text-sm font-semibold">{alignmentCounts[k] ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Recent candidates"
              description="Most recently added candidates"
              actions={<Link to="/candidates" className="text-sm font-medium text-brand-ink hover:underline">View all</Link>}
            />
            {candidates.length === 0 ? (
              <EmptyState
                icon={<Upload />}
                title="No candidates yet"
                description="Upload resumes to start screening."
                action={<Link to="/candidates/upload"><Button variant="primary">Upload resumes</Button></Link>}
              />
            ) : (
              <CandidateTable rows={candidates.slice(0, 8)} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
