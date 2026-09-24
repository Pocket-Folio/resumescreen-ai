import { Link } from "react-router";
import type { CandidateListItem } from "../../../shared/types";
import { AlignmentBadge, DemoBadge, ReviewStatusBadge, ScreeningStatusBadge } from "../StatusBadges";
import { Checkbox } from "../ui/Form";
import { formatDate, initials } from "../../utils/format";
import { cn } from "../../utils/cn";

export function CandidateAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink", className)} aria-hidden>
      {initials(name)}
    </div>
  );
}

export function CandidateTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  compact,
}: {
  rows: CandidateListItem[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (all: boolean) => void;
  compact?: boolean;
}) {
  const selectable = Boolean(selected && onToggle);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected!.has(r.id));
  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[960px]">
        <thead>
          <tr>
            {selectable && (
              <th className="w-10">
                <Checkbox label="Select all candidates" checked={allSelected} onChange={(v) => onToggleAll?.(v)} />
              </th>
            )}
            <th>Candidate</th>
            <th>Position</th>
            <th>Screening status</th>
            <th>Overall match <span className="font-normal normal-case">(AI)</span></th>
            <th>Experience <span className="font-normal normal-case">(AI)</span></th>
            <th>Key skills</th>
            <th>Screened</th>
            <th>HR review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={cn("hover:bg-surface-2/60", selected?.has(r.id) && "bg-brand-soft/40")}>
              {selectable && (
                <td>
                  <Checkbox label={`Select ${r.name}`} checked={selected!.has(r.id)} onChange={() => onToggle!(r.id)} />
                </td>
              )}
              <td>
                <Link to={`/candidates/${r.id}`} className="group flex items-center gap-3">
                  <CandidateAvatar name={r.name} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink group-hover:text-brand-ink group-hover:underline">{r.name}</span>
                      {r.isDemo && !compact && <DemoBadge />}
                    </div>
                    {!compact && <div className="truncate text-xs text-ink-3">{r.email || r.file?.name || "—"}</div>}
                  </div>
                </Link>
              </td>
              <td className="text-ink-2">{r.jobTitle ?? <span className="text-ink-3">Unassigned</span>}</td>
              <td>
                <ScreeningStatusBadge value={r.screeningStatus} />
                {r.extraction.status === "failed" && <div className="mt-1 text-xs text-[var(--red-fg)]">Text extraction failed</div>}
              </td>
              <td>{r.latest ? <AlignmentBadge value={r.latest.overallAssessment} /> : <span className="text-ink-3">—</span>}</td>
              <td className="max-w-[200px] text-ink-2">
                <span className="line-clamp-2">{r.latest?.relevantExperience ?? "—"}</span>
              </td>
              <td className="max-w-[220px]">
                {r.latest?.matchedSkills.length ? (
                  <div className="flex flex-wrap gap-1">
                    {r.latest.matchedSkills.slice(0, 3).map((s) => (
                      <span key={s} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">{s}</span>
                    ))}
                    {r.latest.matchedSkills.length > 3 && <span className="text-xs text-ink-3">+{r.latest.matchedSkills.length - 3}</span>}
                  </div>
                ) : (
                  <span className="text-ink-3">—</span>
                )}
              </td>
              <td className="whitespace-nowrap text-ink-2">{formatDate(r.latest?.createdAt)}</td>
              <td><ReviewStatusBadge review={r.hrReview} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
