import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Columns3, FileSearch, Filter, Search, Trash2, Upload, Users, X } from "lucide-react";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Form";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../components/ui/States";
import { CandidateTable } from "../components/candidates/CandidateTable";
import { REVIEW_STATUS, SCREENING_STATUS } from "../utils/labels";
import { cn } from "../utils/cn";
import type { CandidateListItem, ReviewStatus, ScreeningStatus } from "../../shared/types";

const QUICK_FILTERS = {
  meets_required: { label: "Meets required criteria", test: (c: CandidateListItem) => Boolean(c.latest && c.latest.requiredTotal > 0 && c.latest.requiredMet === c.latest.requiredTotal) },
  needs_verification: { label: "Needs verification", test: (c: CandidateListItem) => Boolean(c.latest && c.latest.needsVerificationCount > 0) },
  missing_info: { label: "Missing information", test: (c: CandidateListItem) => Boolean(c.latest && c.latest.missingInfoCount > 0) },
  screened: { label: "Screened", test: (c: CandidateListItem) => Boolean(c.latest) },
  not_screened: { label: "Not screened", test: (c: CandidateListItem) => !c.latest },
  hr_reviewed: { label: "HR reviewed", test: (c: CandidateListItem) => c.hrReview?.status === "completed" },
  awaiting_review: { label: "Awaiting HR review", test: (c: CandidateListItem) => Boolean(c.latest) && c.hrReview?.status !== "completed" },
} as const;
type QuickFilter = keyof typeof QUICK_FILTERS;

export function CandidatesPage() {
  const { dataVersion } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const q = params.get("q") ?? "";
  const job = params.get("job") ?? "";
  const status = (params.get("status") ?? "") as ScreeningStatus | "";
  const review = (params.get("review") ?? "") as ReviewStatus | "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const filterKey = params.get("filter") ?? "";
  const quick = useMemo(() => new Set(filterKey.split(",").filter((f): f is QuickFilter => f in QUICK_FILTERS)), [filterKey]);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const toggleQuick = (f: QuickFilter) => {
    const next = new Set(quick);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    setParam("filter", [...next].join(","));
  };

  const { data, error, loading, reload } = useAsync(
    async () => {
      const [candidates, jobs] = await Promise.all([api.candidates.list(), api.jobProfiles.list()]);
      return { candidates, jobs };
    },
    [dataVersion],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.candidates.filter((c) => {
      if (needle) {
        const hay = [c.name, c.email, c.jobTitle ?? "", c.location, ...(c.latest?.matchedSkills ?? [])].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (job && (job === "none" ? c.jobProfileId : c.jobProfileId !== job)) return false;
      if (status && c.screeningStatus !== status) return false;
      if (review && (c.hrReview?.status ?? "not_started") !== review) return false;
      const date = (c.latest?.createdAt ?? c.createdAt).slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      for (const f of quick) if (!QUICK_FILTERS[f].test(c)) return false;
      return true;
    });
  }, [data, q, job, status, review, from, to, quick]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;

  const anyFilter = Boolean(q || job || status || review || from || to || quick.size);
  const selectedIds = [...selected].filter((id) => data.candidates.some((c) => c.id === id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Search, filter and review candidates. Select candidates to compare or screen them."
        actions={<Link to="/candidates/upload"><Button variant="primary" icon={<Upload className="size-4" />}>Upload resumes</Button></Link>}
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={q} onChange={(e) => setParam("q", e.target.value)} placeholder="Name, position, skill…" className="pl-9" aria-label="Search candidates" />
          </div>
          <Select value={job} onChange={(e) => setParam("job", e.target.value)} aria-label="Filter by position">
            <option value="">All positions</option>
            {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            <option value="none">Unassigned</option>
          </Select>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by screening status">
            <option value="">Any screening status</option>
            {(Object.keys(SCREENING_STATUS) as ScreeningStatus[]).map((k) => <option key={k} value={k}>{SCREENING_STATUS[k].label}</option>)}
          </Select>
          <Select value={review} onChange={(e) => setParam("review", e.target.value)} aria-label="Filter by review status">
            <option value="">Any review status</option>
            {(Object.keys(REVIEW_STATUS) as ReviewStatus[]).map((k) => <option key={k} value={k}>{REVIEW_STATUS[k].label}</option>)}
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} aria-label="Screened or added from" title="From date" />
            <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} aria-label="Screened or added to" title="To date" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Filter className="size-4 text-ink-3" aria-hidden />
          {(Object.keys(QUICK_FILTERS) as QuickFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => toggleQuick(f)}
              aria-pressed={quick.has(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                quick.has(f) ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-2 hover:border-line-strong",
              )}
            >
              {QUICK_FILTERS[f].label}
            </button>
          ))}
          {anyFilter && (
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {selectedIds.length > 0 && (
        <div className="sticky top-17 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 shadow-sm">
          <span className="text-sm font-medium text-brand-ink">{selectedIds.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" icon={<Columns3 className="size-3.5" />} disabled={selectedIds.length < 2 || selectedIds.length > 5} title={selectedIds.length > 5 ? "Compare up to 5 candidates" : undefined} onClick={() => navigate(`/compare?ids=${selectedIds.join(",")}`)}>
              Compare
            </Button>
            <Button size="sm" icon={<FileSearch className="size-3.5" />} onClick={() => navigate(`/screening?candidates=${selectedIds.join(",")}`)}>
              Screen selected
            </Button>
            <Button size="sm" variant="danger-ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <Card>
        {data.candidates.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No candidates yet"
            description="Upload PDF, DOCX or TXT resumes, or paste resume text, to add candidates."
            action={<Link to="/candidates/upload"><Button variant="primary" icon={<Upload className="size-4" />}>Upload resumes</Button></Link>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Search />} title="No candidates match these filters" action={<Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} />
        ) : (
          <>
            <CandidateTable
              rows={rows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={(all) =>
                setSelected((s) => {
                  const n = new Set(s);
                  for (const r of rows) {
                    if (all) n.add(r.id);
                    else n.delete(r.id);
                  }
                  return n;
                })
              }
            />
            <div className="border-t border-line px-4 py-2.5 text-xs text-ink-3">
              Showing {rows.length} of {data.candidates.length} candidates. “Overall match” and “Experience” are AI-generated and require HR review.
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selectedIds.length} candidate${selectedIds.length === 1 ? "" : "s"}?`}
        destructive
        confirmLabel="Delete permanently"
        message="This permanently deletes the selected candidates' resume text, extracted details, screening history and HR notes from this application. This cannot be undone."
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          let failed = 0;
          for (const id of selectedIds) {
            try {
              await api.candidates.remove(id);
            } catch {
              failed++;
            }
          }
          setConfirmDelete(false);
          setSelected(new Set());
          reload();
          if (failed) toast.error(`${failed} candidate(s) could not be deleted`, "Please try again.");
          else toast.success("Candidate data deleted");
        }}
      />
    </>
  );
}

