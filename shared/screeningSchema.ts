/**
 * Strict schema for Claude's screening output.
 *
 * - Sent to the Claude API as a structured-output JSON schema (server/services/claude/schemas.ts).
 * - Used to validate every response before it is stored or displayed.
 *
 * The API limits how complex a single structured-output schema may be, so a screening is made of
 * two requests that run in parallel: the candidate profile (facts extracted from the resume) and
 * the assessment. They are merged and validated together as `screeningResultSchema`.
 *
 * Field ORDER matters in the assessment: Claude emits keys in schema order, the server uses the
 * first appearance of certain keys to report real progress, and the overall assessment is
 * deliberately last so it is produced after the evidence has been evaluated.
 */
import { z } from "zod";

export const assessmentStatus = z.enum(["meets", "partially_meets", "does_not_meet", "unclear", "not_found"]);
export const confidenceLevel = z.enum(["high", "medium", "low"]);
/** explicit = stated in resume; inferred = Claude's interpretation; absent = no information in resume. */
export const evidenceType = z.enum(["explicit", "inferred", "absent"]);
export const overallAssessment = z.enum([
  "strong_alignment",
  "moderate_alignment",
  "limited_alignment",
  "insufficient_information",
]);

const nullableString = z.string().nullable();

export const experienceEntrySchema = z.object({
  company: z.string(),
  position: z.string(),
  startDate: nullableString,
  endDate: nullableString,
  duration: nullableString.describe("Only if both dates are stated in the resume; otherwise null."),
  responsibilities: z.array(z.string()),
});

export const educationEntrySchema = z.object({
  institution: z.string(),
  degree: nullableString,
  field: nullableString,
  dates: nullableString,
});

export const candidateProfileSchema = z.object({
  currentRole: nullableString,
  experience: z.array(experienceEntrySchema),
  education: z.array(educationEntrySchema),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
    tools: z.array(z.string()),
    languages: z.array(z.string()),
    certifications: z.array(z.string()),
  }),
});

export const experienceAssessmentSchema = z.object({
  company: z.string(),
  role: z.string(),
  dates: nullableString,
  relevance: z.string().describe("Which job criteria this role is relevant to and why."),
  responsibilities: z.array(z.string()),
  evidenceType,
});

export const assessmentItemSchema = z.object({
  item: z.string(),
  requirement: nullableString,
  status: assessmentStatus,
  evidence: z.string(),
  source: nullableString,
  needsVerification: z.boolean(),
});

export const criterionAssessmentSchema = z.object({
  criterion: z.string(),
  importance: z.enum(["required", "important", "preferred"]),
  requirement: z.string(),
  status: assessmentStatus,
  evidence: z.string(),
  source: nullableString.describe("Resume section the evidence comes from, e.g. 'Professional Experience'."),
  evidenceType,
  confidence: confidenceLevel,
  needsVerification: z.boolean(),
  verificationReason: nullableString,
});

/** Request 1: facts about the candidate, as stated in the resume. */
export const profileOutputSchema = z.object({
  candidateProfile: candidateProfileSchema,
  candidateSummary: z.string(),
});

/** Request 2: the assessment against the job profile. */
export const assessmentOutputSchema = z.object({
  matchedSkills: z.array(z.string()),
  partiallyMatchedSkills: z.array(z.string()),
  skillsNotFound: z.array(z.string()),
  additionalSkills: z.array(z.string()),
  experienceAnalysis: z.object({
    totalApparentExperience: nullableString,
    relevantExperience: nullableString,
    industryExperience: nullableString,
    notes: z.string(),
  }),
  relevantExperience: z.array(experienceAssessmentSchema),
  educationAssessment: z.array(assessmentItemSchema),
  certificationAssessment: z.array(assessmentItemSchema),
  criteria: z.array(criterionAssessmentSchema),
  missingInformation: z.array(z.string()),
  verificationItems: z.array(z.string()),
  questionsForHR: z.array(z.string()),
  limitations: z.array(z.string()),
  overallAssessment,
  overallRationale: z.string(),
});

export const screeningResultSchema = profileOutputSchema.extend(assessmentOutputSchema.shape);

/** What Claude returns. */
export type ClaudeScreeningOutput = z.infer<typeof screeningResultSchema>;

/** What the application stores: Claude's output plus server-added metadata. */
export const storedScreeningResultSchema = screeningResultSchema.extend({
  generatedAt: z.string(),
  model: z.string(),
  promptVersion: z.string(),
});

export type ScreeningResult = z.infer<typeof storedScreeningResultSchema>;
export type CriterionAssessment = z.infer<typeof criterionAssessmentSchema>;
export type AssessmentItem = z.infer<typeof assessmentItemSchema>;
export type ExperienceAssessment = z.infer<typeof experienceAssessmentSchema>;
export type AssessmentStatus = z.infer<typeof assessmentStatus>;
export type OverallAssessment = z.infer<typeof overallAssessment>;
