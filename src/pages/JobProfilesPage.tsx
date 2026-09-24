import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Briefcase, Copy, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { DemoBadge } from "../components/StatusBadges";
import { EMPLOYMENT_TYPE } from "../utils/labels";
import { formatDate } from "../utils/format";
import type { JobProfile } from "../../shared/types";

export function JobProfilesPage() {
  const { dataVersion } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<JobProfile | null>(null);
  const { data, error, loading, reload } = useAsync(
    async () => {
      const [jobs, candidates] = await Promise.all([api.jobProfiles.list(), api.candidates.list()]);
      return { jobs, candidates };
    },
    [dataVersion],
  );

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const counts = (id: string) => {
    const list = data.candidates.filter((c) => c.jobProfileId === id);
    return { total: list.length, screened: list.filter((c) => c.latest).length };
  };

  const duplicate = async (j: JobProfile) => {
    try {
      const copy = await api.jobProfiles.duplicate(j.id);
      toast.success("Job profile duplicated");
      navigate(`/job-profiles/${copy.id}`);
    } catch (e) {
      toast.error("Could not duplicate job profile", errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Job Profiles"
        description="Screening profiles define the requirements and criteria that resumes are compared against."
        actions={<Link to="/job-profiles/new"><Button variant="primary" icon={<Plus className="size-4" />}>New job profile</Button></Link>}
      />
      {data.jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase />}
            title="No job profiles yet"
            description="Create a job profile with the requirements and screening criteria for a position."
            action={<Link to="/job-profiles/new"><Button variant="primary" icon={<Plus className="size-4" />}>Create job profile</Button></Link>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.jobs.map((j) => {
            const n = counts(j.id);
            const req = j.criteria.filter((c) => c.importance === "required").length;
            return (
              <Card key={j.id} className="flex flex-col">
                <div className="flex-1 p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {j.status === "archived" ? <Badge tone="gray">Archived</Badge> : <Badge tone="green">Active</Badge>}
                    {j.isDemo && <DemoBadge />}
                  </div>
                  <Link to={`/job-profiles/${j.id}`} className="text-base font-semibold text-ink hover:text-brand-ink hover:underline">{j.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
                    <span>{j.department || "No department"}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{j.location || "—"}</span>
                    <span>{EMPLOYMENT_TYPE[j.employmentType]}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-ink-2">{j.description || "No description."}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-surface-2 p-2"><div className="text-lg font-semibold">{j.criteria.length}</div><div className="text-xs text-ink-3">Criteria</div></div>
                    <div className="rounded-lg bg-surface-2 p-2"><div className="text-lg font-semibold">{req}</div><div className="text-xs text-ink-3">Required</div></div>
                    <div className="rounded-lg bg-surface-2 p-2"><div className="text-lg font-semibold">{n.total}</div><div className="text-xs text-ink-3">Candidates</div></div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
                  <span className="text-xs text-ink-3">Updated {formatDate(j.updatedAt)}</span>
                  <div className="flex gap-1">
                    <Link to={`/candidates?job=${j.id}`}><Button size="sm" variant="ghost" icon={<Users className="size-3.5" />} aria-label={`Candidates for ${j.title}`}>{n.screened}/{n.total}</Button></Link>
                    <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => duplicate(j)} aria-label={`Duplicate ${j.title}`} />
                    <Link to={`/job-profiles/${j.id}`}><Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} aria-label={`Edit ${j.title}`} /></Link>
                    <Button size="sm" variant="danger-ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setToDelete(j)} aria-label={`Delete ${j.title}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete job profile?"
        destructive
        confirmLabel="Delete profile"
        message={
          <>
            <strong>{toDelete?.title}</strong> will be permanently deleted. Candidates assigned to it are kept but become unassigned. Past screening
            results keep a snapshot of this profile.
          </>
        }
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          try {
            await api.jobProfiles.remove(toDelete!.id);
            toast.success("Job profile deleted");
            setToDelete(null);
            reload();
          } catch (e) {
            toast.error("Could not delete job profile", errorMessage(e));
          }
        }}
      />
    </>
  );
}
