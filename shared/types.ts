/**
 * Domain types shared by the server and the React UI.
 * The AI screening result types are derived from the Zod schema in ./screeningSchema.ts.
 */
import type { ScreeningResult } from "./screeningSchema";

export type { ScreeningResult, CriterionAssessment, AssessmentItem, ExperienceAssessment } from "./screeningSchema";

// ─── Job profiles ──────────────────────────────────────────────

export type Importance = "required" | "important" | "preferred";

export type CriterionCategory =
  | "skill"
  | "technical_skill"
  | "experience"
  | "education"
  | "certification"
  | "industry"
  | "language"
  | "other";

export interface ScreeningCriterion {
  id: string;
  criterion: string;
  requirement: string;
  importance: Importance;
  category: CriterionCategory;
}

export interface RequiredQualifications {
  education: string;
  certifications: string;
  skills: string;
  technicalSkills: string;
  yearsExperience: string;
  industryExperience: string;
  languages: string;
}

export interface PreferredQualifications {
  education: string;
  skills: string;
  certifications: string;
  experience: string;
  industryExperience: string;
}

export type EmploymentType = "full_time" | "part_time" | "contract" | "temporary" | "internship";

export interface JobProfile {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  description: string;
  required: RequiredQualifications;
  preferred: PreferredQualifications;
  criteria: ScreeningCriterion[];
  /** Extra, job-specific guidance appended to the screening prompt. */
  screeningInstructions: string;
  status: "active" | "archived";
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type JobProfileInput = Omit<JobProfile, "id" | "createdAt" | "updatedAt" | "isDemo">;

// ─── Candidates ────────────────────────────────────────────────

export type ExtractionStatus = "success" | "failed" | "manual";
export type ScreeningStatus = "not_screened" | "screening" | "screened" | "needs_review";
export type ReviewStatus = "not_started" | "in_progress" | "completed";
export type HRDecision = "continue_review" | "request_more_info" | "hold_for_review" | "not_progressing";

export interface ResumeFileInfo {
  name: string;
  size: number;
  type: "pdf" | "docx" | "txt" | "image" | "manual";
  uploadedAt: string;
}

export interface HRReview {
  reviewer: string;
  status: ReviewStatus;
  notes: string;
  followUpQuestions: string;
  verificationRequired: string;
  decision: HRDecision | null;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  jobProfileId: string | null;
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  resumeText: string;
  file: ResumeFileInfo | null;
  extraction: { status: ExtractionStatus; error: string | null; warnings: string[]; method?: "text" | "ocr" | "claude" | "manual" };
  screeningStatus: ScreeningStatus;
  hrReview: HRReview | null;
  latestScreeningId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Candidate row enriched with a summary of its latest screening, for lists and dashboards. */
export interface CandidateListItem extends Omit<Candidate, "resumeText"> {
  jobTitle: string | null;
  latest: ScreeningSummary | null;
}

export interface ScreeningSummary {
  id: string;
  createdAt: string;
  overallAssessment: ScreeningResult["overallAssessment"];
  relevantExperience: string | null;
  matchedSkills: string[];
  requiredMet: number;
  requiredTotal: number;
  needsVerificationCount: number;
  missingInfoCount: number;
}

// ─── Screenings ────────────────────────────────────────────────

export interface ScreeningRecord {
  id: string;
  candidateId: string;
  jobProfileId: string;
  /** Snapshot of the job profile as it was when screened, so history stays accurate if the profile changes. */
  jobProfileSnapshot: JobProfile;
  model: string;
  promptVersion: string;
  result: ScreeningResult;
  redaction: { contactInfo: boolean; name: boolean };
  usage: { inputTokens: number; outputTokens: number } | null;
  durationMs: number;
  isDemo: boolean;
  createdAt: string;
}

export type ScreeningStage =
  | "reading_resume"
  | "extracting_info"
  | "comparing_qualifications"
  | "evaluating_criteria"
  | "identifying_missing"
  | "preparing_report"
  | "validating";

/** Newline-delimited JSON events streamed from POST /api/screenings. */
export type ScreeningStreamEvent =
  | { type: "stage"; stage: ScreeningStage }
  | { type: "complete"; screening: ScreeningRecord; candidate: Candidate }
  | { type: "error"; error: AppErrorBody };

// ─── Settings & misc ───────────────────────────────────────────

export type Effort = "low" | "medium" | "high";
export type Theme = "light" | "dark" | "system";

export interface AppSettings {
  model: string;
  maxTokens: number;
  effort: Effort;
  theme: Theme;
  redactContactInfo: boolean;
  redactName: boolean;
  privacyNoticeAcknowledgedAt: string | null;
  showPrivacyNoticeEveryTime: boolean;
  exportIncludeResumeText: boolean;
  exportIncludeHrNotes: boolean;
}

export interface ApiKeyStatus {
  configured: boolean;
  source: "environment" | "settings" | "none";
  /** e.g. "sk-ant-…a1B2" — never the full key. */
  masked: string | null;
  workspaceId: string | null;
  workspaceSource: "environment" | "settings" | "none";
}

export interface SystemInfo {
  dataDir: string;
  databaseFile: string;
  databaseSizeBytes: number;
  authEnabled: boolean;
  version: string;
  promptVersion: string;
  counts: { jobProfiles: number; candidates: number; screenings: number; auditEvents: number; demoRecords: number };
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  entityType: "candidate" | "job_profile" | "screening" | "settings" | "system";
  entityId: string | null;
  /** Non-sensitive description; never contains resume content. */
  detail: string;
}

export type AppErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "API_ERROR"
  | "OVERLOADED"
  | "INVALID_RESPONSE"
  | "SCHEMA_TOO_LARGE"
  | "MALFORMED_JSON"
  | "REFUSED"
  | "TRUNCATED"
  | "CANCELLED"
  | "EMPTY_RESUME"
  | "UNSUPPORTED_FILE"
  | "EXTRACTION_FAILED"
  | "FILE_TOO_LARGE"
  | "DATABASE"
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL";

export interface AppErrorBody {
  code: AppErrorCode;
  message: string;
  /** Optional technical detail safe to show in an expandable "details" area. */
  detail?: string;
}

export const MODEL_OPTIONS: { id: string; label: string; note: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Recommended — highest-quality screening" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Faster and lower cost" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fastest, lowest cost; less thorough" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  model: "claude-opus-5",
  maxTokens: 16000,
  effort: "high",
  theme: "light",
  redactContactInfo: true,
  redactName: true,
  privacyNoticeAcknowledgedAt: null,
  showPrivacyNoticeEveryTime: false,
  exportIncludeResumeText: false,
  exportIncludeHrNotes: true,
};
