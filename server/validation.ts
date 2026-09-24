import { z } from "zod";
import { invalid } from "./errors";

const str = (max: number) => z.string().trim().max(max).default("");

export const criterionInput = z.object({
  id: z.string().min(1).max(64),
  criterion: z.string().trim().min(1, "Every criterion needs a name").max(200),
  requirement: str(300),
  importance: z.enum(["required", "important", "preferred"]),
  category: z.enum(["skill", "technical_skill", "experience", "education", "certification", "industry", "language", "other"]),
});

export const jobProfileInput = z.object({
  title: z.string().trim().min(1, "Job title is required").max(160),
  department: str(120),
  location: str(160),
  employmentType: z.enum(["full_time", "part_time", "contract", "temporary", "internship"]),
  description: str(20_000),
  required: z.object({
    education: str(1000),
    certifications: str(1000),
    skills: str(2000),
    technicalSkills: str(2000),
    yearsExperience: str(300),
    industryExperience: str(1000),
    languages: str(500),
  }),
  preferred: z.object({
    education: str(1000),
    skills: str(2000),
    certifications: str(1000),
    experience: str(2000),
    industryExperience: str(1000),
  }),
  criteria: z.array(criterionInput).max(60, "A profile can have at most 60 criteria"),
  screeningInstructions: str(5000),
  status: z.enum(["active", "archived"]).default("active"),
});

// No defaults here: fields that are not sent must stay undefined so they don't overwrite stored values.
const optStr = (max: number) => z.string().trim().max(max).optional();
export const candidateUpdateInput = z.object({
  name: optStr(160),
  email: optStr(200),
  phone: optStr(60),
  location: optStr(160),
  links: z.array(z.string().trim().max(300)).max(10).optional(),
  jobProfileId: z.string().nullable().optional(),
  resumeText: z.string().max(200_000).optional(),
});

export const manualCandidateInput = z.object({
  name: str(160),
  jobProfileId: z.string().nullable().default(null),
  resumeText: z.string().trim().min(1, "Resume text is required").max(200_000),
});

export const hrReviewInput = z.object({
  reviewer: z.string().trim().min(1, "Reviewer name is required").max(120),
  status: z.enum(["not_started", "in_progress", "completed"]),
  notes: str(20_000),
  followUpQuestions: str(10_000),
  verificationRequired: str(10_000),
  decision: z.enum(["continue_review", "request_more_info", "hold_for_review", "not_progressing"]).nullable(),
});

export const settingsInput = z.object({
  model: z.string().trim().min(1).max(80).regex(/^[a-z0-9.-]+$/, "Invalid model id"),
  maxTokens: z.number().int().min(4000).max(64000),
  effort: z.enum(["low", "medium", "high"]),
  theme: z.enum(["light", "dark", "system"]),
  redactContactInfo: z.boolean(),
  redactName: z.boolean(),
  showPrivacyNoticeEveryTime: z.boolean(),
  exportIncludeResumeText: z.boolean(),
  exportIncludeHrNotes: z.boolean(),
});

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    throw invalid(first ? `${first.message}${first.path.length ? ` (${first.path.join(".")})` : ""}` : "Invalid input");
  }
  return r.data;
}
