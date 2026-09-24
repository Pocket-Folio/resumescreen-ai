import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, ArrowLeft, Columns3, Info } from "lucide-react";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { AIBadge, AlignmentBadge, AssessmentBadge, ImportanceBadge, ReviewStatusBadge, VerificationBadge } from "../components/StatusBadges";
import { Badge } from "../components/ui/Badge";
import { formatDate } from "../utils/format";
import type { CriterionAssessment, Importance } from "../../shared/types";

const ORDER: Record<Importance, number> = { required: 0, important: 1, preferred: 2 };

export function ComparePage() {
  const [params] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 5);
  const { data, error, loading, reload } = useAsync(() => Promise.all(ids.map((id) => api.candidates.get(id))), [ids.join(",")]);

  const rows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { criterion: string; importance: Importance; requirement: string; cells: (CriterionAssessment | null)[] }>();
    data.forEach((d, col) => {
      for (const c of d.screenings[0]?.result.criteria ?? []) {
        const key = c.criterion.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { criterion: c.criterion, importance: c.importance, requirement: c.requirement, cells: data.map(() => null) });
        map.get(key)!.cells[col] = c;
      }
    });
    return [...map.values()].sort((a, b) => ORDER[a.importance] - ORDER[b.importance]);
  }, [data]);

  if (ids.length < 2) {
    return (
      <EmptyState
        icon={<Columns3 />}
        title="Select candidates to compare"
        description="On the Candidates page, select 2–5 screened candidates and click Compare."
        action={<Link to="/candidates" className="text-sm font-medium text-brand-ink hover:underline">Go to candidates</Link>}
      />
    );
  }
  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const latest = data.map((d) => d.screenings[0] ?? null);
  const profiles = new Set(latest.filter(Boolean).map((s) => s!.jobProfileId));
  const unscreened = data.filter((_, i) => !latest[i]);

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/candidates" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-3.5" /> Candidates</Link>}
        title="Compare candidates"
        description="Side-by-side comparison of job-related criteria from each candidate's latest screening. Candidates appear in the order you selected them — there is no automatic ranking."
        actions={<AIBadge label="AI-generated assessments" />}
      />
      <div className="mb-4 space-y-2">
        {profiles.size > 1 && (
          <div className="tone-yellow flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> These candidates were screened against different job profiles, so criteria may not line up.</div>
        )}
        {unscreened.length > 0 && (
          <div className="tone-gray flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"><Info className="mt-0.5 size-4 shrink-0" /> Not screened yet: {unscreened.map((d) => d.candidate.name).join(", ")}.</div>
        )}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="table-base" style={{ minWidth: 260 + data.length * 240 }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-64 bg-surface-2">Criterion</th>
                {data.map((d) => (
                  <th key={d.candidate.id} className="min-w-[240px] normal-case">
                    <Link to={`/candidates/${d.candidate.id}?tab=report`} className="text-sm font-semibold text-ink hover:text-brand-ink hover:underline">{d.candidate.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-surface-2/40">
                <td className="sticky left-0 bg-surface font-medium">Overall alignment <span className="text-xs font-normal text-ink-3">(AI)</span></td>
                {latest.map((s, i) => <td key={i}>{s ? <AlignmentBadge value={s.result.overallAssessment} /> : <span className="text-ink-3">Not screened</span>}</td>)}
              </tr>
              <tr>
                <td className="sticky left-0 bg-surface font-medium">Screened against</td>
                {latest.map((s, i) => <td key={i} className="text-ink-2">{s ? `${s.jobProfileSnapshot.title} · ${formatDate(s.createdAt)}` : "—"}</td>)}
              </tr>
              <tr>
                <td className="sticky left-0 bg-surface font-medium">Required criteria met</td>
                {latest.map((s, i) => {
                  const req = s?.result.criteria.filter((c) => c.importance === "required") ?? [];
                  return <td key={i}>{s ? `${req.filter((c) => c.status === "meets").length} of ${req.length}` : "—"}</td>;
                })}
              </tr>
              <tr>
                <td className="sticky left-0 bg-surface font-medium">Items needing verification</td>
                {latest.map((s, i) => <td key={i}>{s ? s.result.criteria.filter((c) => c.needsVerification).length : "—"}</td>)}
              </tr>
              <tr>
                <td className="sticky left-0 bg-surface font-medium">Missing information</td>
                {latest.map((s, i) => <td key={i}>{s ? s.result.missingInformation.length : "—"}</td>)}
              </tr>
              <tr>
                <td className="sticky left-0 bg-surface font-medium">HR review <Badge tone="indigo" className="ml-1">HR</Badge></td>
                {data.map((d) => <td key={d.candidate.id}><ReviewStatusBadge review={d.candidate.hrReview} /></td>)}
              </tr>
              {rows.map((r) => (
                <tr key={r.criterion}>
                  <td className="sticky left-0 bg-surface">
                    <div className="font-medium">{r.criterion}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5"><ImportanceBadge value={r.importance} /><span className="text-xs text-ink-3">{r.requirement}</span></div>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i}>
                      {c ? (
                        <details className="group">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                            <AssessmentBadge value={c.status} />
                            {c.needsVerification && <VerificationBadge />}
                            <span className="text-xs text-brand-ink group-open:hidden">Evidence</span>
                          </summary>
                          <p className="mt-2 text-xs text-ink-2">{c.evidence}</p>
                          {c.source && <p className="mt-1 text-xs text-ink-3">Source: Resume → {c.source}</p>}
                        </details>
                      ) : (
                        <span className="text-xs text-ink-3">Not assessed</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
