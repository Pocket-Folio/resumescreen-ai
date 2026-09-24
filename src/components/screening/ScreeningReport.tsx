import { Fragment, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleHelp,
  GraduationCap,
  Info,
  MessageSquareText,
  SearchX,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { storedScreeningResultSchema, type AssessmentItem, type AssessmentStatus } from "../../../shared/screeningSchema";
import type { ScreeningRecord } from "../../../shared/types";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ErrorState } from "../ui/States";
import { AIBadge, AssessmentBadge, DemoBadge, ImportanceBadge, VerificationBadge } from "../StatusBadges";
import { ALIGNMENT, EVIDENCE_TYPE } from "../../utils/labels";
import { formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

const STATUS_ICON: Record<AssessmentStatus, ReactNode> = {
  meets: <CheckCircle2 className="size-4 text-[var(--green-fg)]" aria-hidden />,
  partially_meets: <AlertTriangle className="size-4 text-[var(--yellow-fg)]" aria-hidden />,
  does_not_meet: <XCircle className="size-4 text-[var(--red-fg)]" aria-hidden />,
  unclear: <CircleHelp className="size-4 text-[var(--purple-fg)]" aria-hidden />,
  not_found: <CircleDashed className="size-4 text-ink-3" aria-hidden />,
};

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", tone)}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

function List({ items, empty, icon }: { items: string[]; empty: string; icon?: ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
          <span className="mt-0.5 shrink-0">{icon ?? "•"}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items, tone, empty }: { items: string[]; tone: "green" | "yellow" | "gray" | "indigo"; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => <Badge key={s} tone={tone}>{s}</Badge>)}
    </div>
  );
}

const BASED_ON_RESUME = "Based on information available in the resume.";

// ─── Sections ────────────────────────────────────────────────

function AssessmentHeader({ record }: { record: ScreeningRecord }) {
  const r = record.result;
  const count = (s: AssessmentStatus) => r.criteria.filter((c) => c.status === s).length;
  const verify = r.criteria.filter((c) => c.needsVerification).length;
  const a = ALIGNMENT[r.overallAssessment];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">Screening assessment</h2>
            <AIBadge />
            {record.isDemo && <DemoBadge />}
          </div>
          <p className="text-xs text-ink-3">
            {formatDate(record.createdAt, true)} · {record.model} · prompt {record.promptVersion} · against “{record.jobProfileSnapshot.title}”
          </p>
        </div>
      </div>
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className={cn(`tone-${a.tone}`, "rounded-xl border px-4 py-3")}>
            <div className="text-xs font-medium tracking-wide uppercase opacity-80">Resume alignment with criteria</div>
            <div className="mt-0.5 text-xl font-semibold">{a.label}</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-ink-2">{r.overallRationale}</p>
            <p className="mt-2 text-xs text-ink-3">{a.description} This label describes how the resume, as written, aligns with the configured criteria. It is not a hiring decision.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Criteria met" value={count("meets")} tone="tone-green" />
          <Stat label="Partially met" value={count("partially_meets")} tone="tone-yellow" />
          <Stat label="Not met (per resume)" value={count("does_not_meet")} tone="tone-red" />
          <Stat label="Not found / unclear" value={count("not_found") + count("unclear")} tone="tone-gray" />
          <Stat label="Require verification" value={verify} tone="tone-blue" />
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Claude assisted with this review. The HR team is responsible for verifying the evidence and making any decision.
            {record.redaction.contactInfo || record.redaction.name
              ? ` Before sending, ${[record.redaction.name && "the candidate's name", record.redaction.contactInfo && "contact details"].filter(Boolean).join(" and ")} were redacted from the resume.`
              : ""}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function CriteriaComparison({ record }: { record: ScreeningRecord }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const all = open.size === record.result.criteria.length;
  return (
    <Card>
      <CardHeader
        title="Criteria comparison"
        description="Each configured criterion with the resume evidence Claude found. Expand a row to inspect the evidence and its source."
        actions={
          <button className="text-sm font-medium text-brand-ink hover:underline" onClick={() => setOpen(all ? new Set() : new Set(record.result.criteria.map((_, i) => i)))}>
            {all ? "Collapse all" : "Expand all"}
          </button>
        }
      />
      <div className="overflow-x-auto">
        <table className="table-base min-w-[900px]">
          <thead>
            <tr>
              <th className="w-8"><span className="sr-only">Expand</span></th>
              <th>Criterion</th>
              <th>Importance</th>
              <th>Requirement</th>
              <th>Resume evidence</th>
              <th>AI assessment</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {record.result.criteria.map((c, i) => {
              const isOpen = open.has(i);
              const ev = EVIDENCE_TYPE[c.evidenceType];
              return (
                <Fragment key={i}>
                  <tr className={cn("cursor-pointer hover:bg-surface-2/60", isOpen && "bg-surface-2/60")} onClick={() => toggle(i)}>
                    <td>
                      <button
                        className="rounded p-0.5 text-ink-3 hover:text-ink"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} evidence for ${c.criterion}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(i);
                        }}
                      >
                        {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </td>
                    <td className="font-medium">
                      <span className="flex items-center gap-2">{STATUS_ICON[c.status]}{c.criterion}</span>
                    </td>
                    <td><ImportanceBadge value={c.importance} /></td>
                    <td className="max-w-[180px] text-ink-2">{c.requirement || "—"}</td>
                    <td className="max-w-[340px] text-ink-2"><span className="line-clamp-2">{c.evidence}</span></td>
                    <td><AssessmentBadge value={c.status} /></td>
                    <td>{c.needsVerification ? <VerificationBadge /> : <span className="text-xs text-ink-3">Not flagged</span>}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-surface-2/60">
                      <td />
                      <td colSpan={6} className="pt-0">
                        <div className="rounded-lg border border-line bg-surface p-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">AI assessment:</span>
                            <AssessmentBadge value={c.status} />
                            <Badge tone={ev.tone}>{ev.label}</Badge>
                            <Badge tone="gray">Confidence: {c.confidence}</Badge>
                          </div>
                          <div className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Evidence</div>
                          <p className="mt-1 text-sm text-ink">{c.evidence}</p>
                          <div className="mt-3 text-xs font-semibold tracking-wide text-ink-3 uppercase">Source</div>
                          <p className="mt-1 text-sm text-ink-2">{c.source ? `Resume → ${c.source}` : "No matching section in the resume"}</p>
                          {c.needsVerification && (
                            <div className="tone-blue mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                              <span><strong>Verification recommended.</strong> {c.verificationReason ?? "Confirm this with the candidate."}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SkillsAnalysis({ record }: { record: ScreeningRecord }) {
  const r = record.result;
  return (
    <Card>
      <CardHeader title="Skills analysis" icon={<Sparkles className="size-4" />} actions={<AIBadge label="AI-generated" />} />
      <CardBody className="space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CheckCircle2 className="size-4 text-[var(--green-fg)]" aria-hidden /> Matched skills</h3>
            <Chips items={r.matchedSkills} tone="green" empty="None identified." />
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="size-4 text-[var(--yellow-fg)]" aria-hidden /> Partially demonstrated</h3>
            <Chips items={r.partiallyMatchedSkills} tone="yellow" empty="None identified." />
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><SearchX className="size-4 text-ink-3" aria-hidden /> Not found in resume</h3>
            <Chips items={r.skillsNotFound} tone="gray" empty="None — all listed skills were found." />
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <h3 className="mb-1 text-sm font-semibold">Additional skills</h3>
          <p className="mb-2 text-xs text-ink-3">Job-relevant skills in the resume that the profile did not ask for. Listed for information only — they are not scored as positive or negative.</p>
          <Chips items={r.additionalSkills} tone="indigo" empty="None identified." />
        </div>
      </CardBody>
    </Card>
  );
}

function ExperienceAnalysis({ record }: { record: ScreeningRecord }) {
  const e = record.result.experienceAnalysis;
  const rows: [string, string | null][] = [
    ["Total apparent experience", e.totalApparentExperience],
    ["Relevant experience", e.relevantExperience],
    ["Industry experience", e.industryExperience],
  ];
  return (
    <Card>
      <CardHeader title="Experience analysis" description={BASED_ON_RESUME} icon={<Briefcase className="size-4" />} actions={<AIBadge label="AI-generated" />} />
      <CardBody className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line p-3">
              <dt className="text-xs font-medium text-ink-3">{k}</dt>
              <dd className={cn("mt-1 text-sm", v ? "text-ink" : "text-ink-3 italic")}>{v ?? "Could not be determined from the resume"}</dd>
            </div>
          ))}
        </dl>
        {e.notes && <p className="text-sm text-ink-2">{e.notes}</p>}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Relevant roles</h3>
          {record.result.relevantExperience.length === 0 ? (
            <p className="text-sm text-ink-3">No roles identified as relevant to the criteria.</p>
          ) : (
            <ul className="space-y-3">
              {record.result.relevantExperience.map((x, i) => (
                <li key={i} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{x.role} <span className="font-normal text-ink-3">· {x.company}</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-3">{x.dates ?? "Dates not stated"}</span>
                      <Badge tone={EVIDENCE_TYPE[x.evidenceType].tone}>{EVIDENCE_TYPE[x.evidenceType].label}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{x.relevance}</p>
                  {x.responsibilities.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                      {x.responsibilities.map((r, j) => <li key={j}>{r}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ItemList({ items, empty }: { items: AssessmentItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">{STATUS_ICON[it.status]}{it.item}</span>
            <div className="flex flex-wrap gap-1.5">
              <AssessmentBadge value={it.status} />
              {it.needsVerification && <VerificationBadge />}
            </div>
          </div>
          {it.requirement && <p className="mt-1 text-xs text-ink-3">Requirement: {it.requirement}</p>}
          <p className="mt-1.5 text-sm text-ink-2">{it.evidence}</p>
          {it.source && <p className="mt-1 text-xs text-ink-3">Source: Resume → {it.source}</p>}
        </li>
      ))}
    </ul>
  );
}

function EducationCertifications({ record }: { record: ScreeningRecord }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Education" icon={<GraduationCap className="size-4" />} actions={<AIBadge label="AI-generated" />} />
        <CardBody><ItemList items={record.result.educationAssessment} empty="The job profile has no education requirements." /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Certifications" icon={<BookOpen className="size-4" />} actions={<AIBadge label="AI-generated" />} />
        <CardBody><ItemList items={record.result.certificationAssessment} empty="The job profile has no certification requirements." /></CardBody>
      </Card>
    </div>
  );
}

function MissingInformation({ record }: { record: ScreeningRecord }) {
  const r = record.result;
  return (
    <Card className="border-[var(--yellow-bd)]">
      <CardHeader title="Information not found" icon={<SearchX className="size-4" />} actions={<AIBadge label="AI-generated" />} />
      <CardBody className="space-y-3">
        <div className="tone-yellow flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Information missing from a resume is <strong>not</strong> evidence that the candidate lacks the qualification. Consider asking the candidate about these items.</span>
        </div>
        <List items={r.missingInformation} empty="No missing information was identified." icon={<CircleDashed className="size-4 text-ink-3" />} />
      </CardBody>
    </Card>
  );
}

function VerificationAndQuestions({ record }: { record: ScreeningRecord }) {
  const r = record.result;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Requires human verification" icon={<ShieldAlert className="size-4" />} actions={<AIBadge label="AI-generated" />} />
        <CardBody><List items={r.verificationItems} empty="No items were flagged for verification." icon={<ShieldAlert className="size-4 text-[var(--blue-fg)]" />} /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Suggested follow-up questions" icon={<MessageSquareText className="size-4" />} actions={<AIBadge label="AI-generated" />} />
        <CardBody><List items={r.questionsForHR} empty="No questions suggested." icon={<MessageSquareText className="size-4 text-ink-3" />} /></CardBody>
      </Card>
    </div>
  );
}

// ─── Public component ────────────────────────────────────────

/** Full AI screening report. Refuses to render a result that fails schema validation. */
export function ScreeningReport({ record }: { record: ScreeningRecord }) {
  const valid = storedScreeningResultSchema.safeParse(record.result);
  if (!valid.success) {
    return (
      <ErrorState
        title="This screening result cannot be displayed"
        message="The stored result does not match the expected format, so it is not shown to avoid displaying incorrect information. Run the screening again to generate a new result."
        detail={valid.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}
      />
    );
  }
  return (
    <div className="space-y-6">
      <AssessmentHeader record={record} />
      <CriteriaComparison record={record} />
      <MissingInformation record={record} />
      <SkillsAnalysis record={record} />
      <ExperienceAnalysis record={record} />
      <EducationCertifications record={record} />
      <VerificationAndQuestions record={record} />
      {record.result.limitations.length > 0 && (
        <Card>
          <CardHeader title="Limitations of this screening" icon={<AlertTriangle className="size-4" />} />
          <CardBody><List items={record.result.limitations} empty="" /></CardBody>
        </Card>
      )}
    </div>
  );
}

