/**
 * Report builders and exporters (PDF, CSV, JSON). Everything runs in the browser; nothing is
 * uploaded. Every report separates AI-generated content from HR-entered information.
 */
import type { AppSettings, AuditEvent, Candidate, CandidateListItem, JobProfile, ScreeningRecord } from "../../shared/types";
import { ALIGNMENT, ASSESSMENT, DECISION, EVIDENCE_TYPE, IMPORTANCE, REVIEW_STATUS, SCREENING_STATUS } from "./labels";

export type ExportFormat = "pdf" | "csv" | "json";

const AI_NOTICE =
  "AI-generated content was produced by Claude to assist HR review. It describes alignment between the resume and the configured criteria and is not a hiring decision. HR is responsible for verification and all decisions.";

// ─── Low-level helpers ───────────────────────────────────────

export function download(filename: string, content: Blob | string, type = "application/octet-stream") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV with protection against spreadsheet formula injection. */
export function toCSV(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
const stamp = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "");

/** jsPDF's built-in fonts only cover Windows-1252; replace anything else so text never garbles. */
const PDF_EXTRA = new Set([0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x20ac]);
function pdfSafe(s: string): string {
  const mapped = s.replace(/[→⇒]/g, "->").replace(/[✓✔]/g, "v").replace(/[•·]/g, "-");
  let out = "";
  for (const ch of mapped) {
    const cp = ch.codePointAt(0)!;
    const ok = cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255) || PDF_EXTRA.has(cp);
    out += ok ? ch : "?";
  }
  return out;
}

interface PdfSection {
  heading: string;
  tag?: "AI-GENERATED" | "HR-ENTERED" | "SYSTEM";
  paragraphs?: string[];
  table?: { head: string[]; body: string[][] };
  keyValues?: [string, string][];
}

async function buildPdf(title: string, subtitle: string, sections: PdfSection[]): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = [17, 24, 39]) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafe(s), W - 2 * M) as string[];
    for (const line of lines) {
      ensure(size * 1.4);
      doc.text(line, M, y);
      y += size * 1.4;
    }
  };

  text(title, 18, "bold");
  text(subtitle, 9, "normal", [107, 114, 128]);
  y += 6;
  text(AI_NOTICE, 8, "normal", [107, 114, 128]);
  y += 8;

  const TAG_COLORS: Record<string, [number, number, number]> = { "AI-GENERATED": [109, 40, 217], "HR-ENTERED": [67, 56, 202], SYSTEM: [75, 85, 99] };
  for (const s of sections) {
    ensure(40);
    y += 8;
    if (s.tag) text(s.tag, 7, "bold", TAG_COLORS[s.tag]);
    text(s.heading, 12, "bold");
    y += 2;
    for (const p of s.paragraphs ?? []) {
      text(p, 9.5);
      y += 3;
    }
    if (s.keyValues?.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        body: s.keyValues.map(([k, v]) => [pdfSafe(k), pdfSafe(v || "—")]),
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
    if (s.table && s.table.body.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [s.table.head.map(pdfSafe)],
        body: s.table.body.map((r) => r.map(pdfSafe)),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 4, valign: "top" },
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: "bold" },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(`ResumeScreen AI · Confidential — contains candidate personal information · Page ${i} of ${pages}`, M, doc.internal.pageSize.getHeight() - 20);
  }
  return doc.output("blob");
}

// ─── Candidate screening report ──────────────────────────────

export function candidateReportData(candidate: Candidate, screening: ScreeningRecord | null, opts: Pick<AppSettings, "exportIncludeHrNotes" | "exportIncludeResumeText">) {
  const r = screening?.result;
  return {
    reportType: "candidate_screening_report",
    generatedAt: new Date().toISOString(),
    notice: AI_NOTICE,
    candidate: {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      links: candidate.links,
      position: screening?.jobProfileSnapshot.title ?? null,
      isDemo: candidate.isDemo,
      ...(opts.exportIncludeResumeText ? { resumeText: candidate.resumeText } : {}),
    },
    aiGeneratedAssessment: r
      ? {
          source: "AI-generated (Claude)",
          screenedAt: screening!.createdAt,
          model: screening!.model,
          promptVersion: screening!.promptVersion,
          jobProfile: screening!.jobProfileSnapshot.title,
          overallAssessment: ALIGNMENT[r.overallAssessment].label,
          overallRationale: r.overallRationale,
          summary: r.candidateSummary,
          criteria: r.criteria,
          matchedSkills: r.matchedSkills,
          partiallyMatchedSkills: r.partiallyMatchedSkills,
          skillsNotFound: r.skillsNotFound,
          additionalSkills: r.additionalSkills,
          experienceAnalysis: r.experienceAnalysis,
          relevantExperience: r.relevantExperience,
          educationAssessment: r.educationAssessment,
          certificationAssessment: r.certificationAssessment,
          missingInformation: r.missingInformation,
          verificationItems: r.verificationItems,
          questionsForHR: r.questionsForHR,
          limitations: r.limitations,
        }
      : null,
    hrEnteredInformation: candidate.hrReview
      ? {
          source: "HR-entered",
          reviewer: candidate.hrReview.reviewer,
          reviewStatus: REVIEW_STATUS[candidate.hrReview.status].label,
          decision: candidate.hrReview.decision ? DECISION[candidate.hrReview.decision].label : null,
          updatedAt: candidate.hrReview.updatedAt,
          ...(opts.exportIncludeHrNotes
            ? {
                notes: candidate.hrReview.notes,
                followUpQuestions: candidate.hrReview.followUpQuestions,
                verificationRequired: candidate.hrReview.verificationRequired,
              }
            : {}),
        }
      : null,
  };
}

export async function exportCandidateReport(
  format: ExportFormat,
  candidate: Candidate,
  screening: ScreeningRecord | null,
  opts: Pick<AppSettings, "exportIncludeHrNotes" | "exportIncludeResumeText">,
) {
  const base = `screening-report-${slug(candidate.name)}-${stamp()}`;
  const data = candidateReportData(candidate, screening, opts);
  if (format === "json") return download(`${base}.json`, JSON.stringify(data, null, 2), "application/json");

  const r = screening?.result;
  if (format === "csv") {
    const rows: (string | number | boolean | null)[][] = [
      ["Section", "Source", "Item", "Importance", "Requirement", "Assessment", "Evidence", "Resume section", "Evidence type", "Confidence", "Needs verification"],
    ];
    if (r) {
      rows.push(["Overall", "AI-generated", "Overall alignment", "", "", ALIGNMENT[r.overallAssessment].label, r.overallRationale, "", "", "", ""]);
      for (const c of r.criteria)
        rows.push(["Criteria", "AI-generated", c.criterion, IMPORTANCE[c.importance].label, c.requirement, ASSESSMENT[c.status].label, c.evidence, c.source ?? "", EVIDENCE_TYPE[c.evidenceType].label, c.confidence, c.needsVerification ? "Yes" : "No"]);
      for (const m of r.missingInformation) rows.push(["Missing information", "AI-generated", m, "", "", "", "", "", "", "", ""]);
      for (const v of r.verificationItems) rows.push(["Verification", "AI-generated", v, "", "", "", "", "", "", "", "Yes"]);
    }
    if (candidate.hrReview) {
      const h = candidate.hrReview;
      rows.push(["HR review", "HR-entered", "Reviewer", "", "", h.reviewer, "", "", "", "", ""]);
      rows.push(["HR review", "HR-entered", "Review status", "", "", REVIEW_STATUS[h.status].label, "", "", "", "", ""]);
      rows.push(["HR review", "HR-entered", "HR decision", "", "", h.decision ? DECISION[h.decision].label : "", "", "", "", "", ""]);
      if (opts.exportIncludeHrNotes) rows.push(["HR review", "HR-entered", "Notes", "", "", "", h.notes, "", "", "", ""]);
    }
    return download(`${base}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }

  download(`${base}.pdf`, await candidatePdf(candidate, screening, opts));
}

/** Builds the candidate report PDF (separate from download so it can be tested). */
export async function candidatePdf(
  candidate: Candidate,
  screening: ScreeningRecord | null,
  opts: Pick<AppSettings, "exportIncludeHrNotes" | "exportIncludeResumeText">,
): Promise<Blob> {
  const r = screening?.result;
  const sections: PdfSection[] = [
    {
      heading: "Candidate",
      tag: "SYSTEM",
      keyValues: [
        ["Name", candidate.name],
        ["Email", candidate.email],
        ["Phone", candidate.phone],
        ["Location", candidate.location],
        ["Position", screening?.jobProfileSnapshot.title ?? "Not screened"],
      ],
    },
  ];
  if (r && screening) {
    sections.push(
      {
        heading: "Screening assessment",
        tag: "AI-GENERATED",
        keyValues: [
          ["Overall alignment", ALIGNMENT[r.overallAssessment].label],
          ["Screened", fmt(screening.createdAt)],
          ["Model / prompt", `${screening.model} / ${screening.promptVersion}`],
        ],
        paragraphs: [r.overallRationale, `Summary: ${r.candidateSummary}`],
      },
      {
        heading: "Criteria comparison",
        tag: "AI-GENERATED",
        table: {
          head: ["Criterion", "Importance", "Requirement", "Assessment", "Evidence (source)", "Verify"],
          body: r.criteria.map((c) => [c.criterion, IMPORTANCE[c.importance].label, c.requirement, ASSESSMENT[c.status].label, `${c.evidence}${c.source ? ` (${c.source})` : ""}`, c.needsVerification ? "Yes" : "No"]),
        },
      },
      {
        heading: "Skills",
        tag: "AI-GENERATED",
        keyValues: [
          ["Matched", r.matchedSkills.join(", ")],
          ["Partially demonstrated", r.partiallyMatchedSkills.join(", ")],
          ["Not found in resume", r.skillsNotFound.join(", ")],
          ["Additional (not scored)", r.additionalSkills.join(", ")],
        ],
      },
      {
        heading: "Experience (based on information available in the resume)",
        tag: "AI-GENERATED",
        keyValues: [
          ["Total apparent", r.experienceAnalysis.totalApparentExperience ?? "Could not be determined"],
          ["Relevant", r.experienceAnalysis.relevantExperience ?? "Could not be determined"],
          ["Industry", r.experienceAnalysis.industryExperience ?? "Could not be determined"],
        ],
      },
      {
        heading: "Education & certifications",
        tag: "AI-GENERATED",
        table: {
          head: ["Item", "Requirement", "Assessment", "Evidence", "Verify"],
          body: [...r.educationAssessment, ...r.certificationAssessment].map((i) => [i.item, i.requirement ?? "", ASSESSMENT[i.status].label, i.evidence, i.needsVerification ? "Yes" : "No"]),
        },
      },
      {
        heading: "Information not found",
        tag: "AI-GENERATED",
        paragraphs: [
          "Absence of information in a resume is not evidence that the candidate lacks the qualification.",
          ...(r.missingInformation.length ? r.missingInformation.map((m) => `- ${m}`) : ["None identified."]),
        ],
      },
      {
        heading: "Verification items and suggested questions",
        tag: "AI-GENERATED",
        paragraphs: [...r.verificationItems.map((v) => `Verify: ${v}`), ...r.questionsForHR.map((q) => `Ask: ${q}`)],
      },
    );
  } else {
    sections.push({ heading: "Screening assessment", tag: "AI-GENERATED", paragraphs: ["This candidate has not been screened."] });
  }
  const h = candidate.hrReview;
  sections.push({
    heading: "HR review",
    tag: "HR-ENTERED",
    ...(h
      ? {
          keyValues: [
            ["Reviewer", h.reviewer],
            ["Review status", REVIEW_STATUS[h.status].label],
            ["HR decision", h.decision ? DECISION[h.decision].label : "Not recorded"],
            ["Last updated", fmt(h.updatedAt)],
            ...(opts.exportIncludeHrNotes
              ? ([
                  ["Notes", h.notes],
                  ["Follow-up questions", h.followUpQuestions],
                  ["Verification required", h.verificationRequired],
                ] as [string, string][])
              : []),
          ],
        }
      : { paragraphs: ["No HR review has been recorded."] }),
  });
  if (opts.exportIncludeResumeText) sections.push({ heading: "Resume text", tag: "SYSTEM", paragraphs: [candidate.resumeText] });

  return buildPdf(`Candidate screening report — ${candidate.name}`, `Generated ${new Date().toLocaleString()} by ResumeScreen AI${candidate.isDemo ? " · DEMO DATA" : ""}`, sections);
}

// ─── Job screening summary ───────────────────────────────────

export async function exportJobSummary(format: ExportFormat, job: JobProfile, candidates: CandidateListItem[]) {
  const base = `job-screening-summary-${slug(job.title)}-${stamp()}`;
  const list = candidates.filter((c) => c.jobProfileId === job.id);
  const rows = list.map((c) => ({
    candidate: c.name,
    screeningStatus: SCREENING_STATUS[c.screeningStatus].label,
    aiOverallAlignment: c.latest ? ALIGNMENT[c.latest.overallAssessment].label : "",
    aiRequiredCriteriaMet: c.latest ? `${c.latest.requiredMet}/${c.latest.requiredTotal}` : "",
    aiVerificationItems: c.latest?.needsVerificationCount ?? "",
    aiMissingInformationItems: c.latest?.missingInfoCount ?? "",
    screenedAt: c.latest?.createdAt ?? "",
    hrReviewStatus: REVIEW_STATUS[c.hrReview?.status ?? "not_started"].label,
    hrDecision: c.hrReview?.decision ? DECISION[c.hrReview.decision].label : "",
    hrReviewer: c.hrReview?.reviewer ?? "",
  }));

  if (format === "json") {
    return download(
      `${base}.json`,
      JSON.stringify(
        {
          reportType: "job_screening_summary",
          generatedAt: new Date().toISOString(),
          notice: AI_NOTICE,
          fieldSources: { "ai*": "AI-generated", "hr*": "HR-entered" },
          jobProfile: { title: job.title, department: job.department, location: job.location, criteria: job.criteria },
          candidates: rows,
        },
        null,
        2,
      ),
      "application/json",
    );
  }
  const head = ["Candidate", "Screening status", "AI: overall alignment", "AI: required met", "AI: verification items", "AI: missing info", "Screened", "HR: review status", "HR: decision", "HR: reviewer"];
  const body = rows.map((r) => [r.candidate, r.screeningStatus, r.aiOverallAlignment, r.aiRequiredCriteriaMet, String(r.aiVerificationItems), String(r.aiMissingInformationItems), r.screenedAt ? fmt(r.screenedAt) : "", r.hrReviewStatus, r.hrDecision, r.hrReviewer]);
  if (format === "csv") return download(`${base}.csv`, toCSV([head, ...body]), "text/csv;charset=utf-8");

  const blob = await buildPdf(`Job screening summary — ${job.title}`, `${job.department || "No department"} · ${job.location || "—"} · Generated ${new Date().toLocaleString()}`, [
    {
      heading: "Screening criteria",
      tag: "SYSTEM",
      table: { head: ["Criterion", "Requirement", "Importance"], body: job.criteria.map((c) => [c.criterion, c.requirement, IMPORTANCE[c.importance].label]) },
    },
    {
      heading: `Candidates (${list.length})`,
      paragraphs: ["Columns prefixed “AI” are AI-generated; columns prefixed “HR” are entered by HR staff. Candidates are listed alphabetically, not ranked."],
      table: { head, body: body.sort((a, b) => a[0].localeCompare(b[0])) },
    },
  ]);
  download(`${base}.pdf`, blob);
}

// ─── Screening activity report ───────────────────────────────

export async function exportActivityReport(format: ExportFormat, events: AuditEvent[], screenings: ScreeningRecord[], range: { from: string; to: string }, candidateNames: Map<string, string>) {
  const base = `screening-activity-${range.from || "start"}-to-${range.to || stamp()}`;
  const inRange = (iso: string) => (!range.from || iso.slice(0, 10) >= range.from) && (!range.to || iso.slice(0, 10) <= range.to);
  const ev = events.filter((e) => inRange(e.at));
  const sc = screenings.filter((s) => inRange(s.createdAt));
  const scRows = sc.map((s) => ({
    date: s.createdAt,
    candidate: candidateNames.get(s.candidateId) ?? "(deleted)",
    jobProfile: s.jobProfileSnapshot.title,
    model: s.model,
    promptVersion: s.promptVersion,
    aiOverallAlignment: ALIGNMENT[s.result.overallAssessment].label,
    demo: s.isDemo,
  }));

  if (format === "json") {
    return download(`${base}.json`, JSON.stringify({ reportType: "screening_activity_report", generatedAt: new Date().toISOString(), range, notice: AI_NOTICE, screenings: scRows, auditEvents: ev }, null, 2), "application/json");
  }
  if (format === "csv") {
    const rows: (string | boolean)[][] = [["Type", "Date", "Candidate", "Job profile", "Model", "Prompt version", "AI: overall alignment", "Action", "Detail"]];
    for (const s of scRows) rows.push(["Screening", fmt(s.date), s.candidate, s.jobProfile, s.model, s.promptVersion, s.aiOverallAlignment, "", ""]);
    for (const e of ev) rows.push(["Audit event", fmt(e.at), "", "", "", "", "", e.action, e.detail]);
    return download(`${base}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }
  const blob = await buildPdf("Screening activity report", `${range.from || "All time"} to ${range.to || "today"} · Generated ${new Date().toLocaleString()}`, [
    {
      heading: `Screenings (${scRows.length})`,
      tag: "AI-GENERATED",
      table: { head: ["Date", "Candidate", "Job profile", "Model / prompt", "AI: overall alignment"], body: scRows.map((s) => [fmt(s.date), s.candidate, s.jobProfile, `${s.model} / ${s.promptVersion}`, s.aiOverallAlignment]) },
    },
    {
      heading: `Audit log (${ev.length} events)`,
      tag: "SYSTEM",
      table: { head: ["Date", "Action", "Detail"], body: ev.map((e) => [fmt(e.at), e.action, e.detail]) },
    },
  ]);
  download(`${base}.pdf`, blob);
}
