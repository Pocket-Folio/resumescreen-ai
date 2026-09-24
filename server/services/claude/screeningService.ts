/**
 * Screening engine: builds the prompt, calls Claude with a strict output schema, reports progress,
 * and validates the result. It has no knowledge of HTTP or the database.
 */
import type { JobProfile, ScreeningCriterion, ScreeningResult, ScreeningStage, Effort } from "../../../shared/types";
import { AppError } from "../../errors";
import { redactResume } from "../redaction";
import { runStructured } from "./claudeClient";
import { PROMPT_VERSION, SCREENING_SYSTEM_PROMPT, buildScreeningUserPrompt } from "./prompts/screenCandidate";
import { assessmentOutputFormat, profileOutputFormat, validateScreeningOutput } from "./schemas";

export interface ScreeningRequest {
  candidate: { name?: string; resumeText: string };
  jobProfile: {
    title: string;
    description: string;
    requiredCriteria: ScreeningCriterion[];
    importantCriteria: ScreeningCriterion[];
    preferredCriteria: ScreeningCriterion[];
  };
}

export interface ScreeningOptions {
  /** Full profile (qualification fields + instructions) used to build the prompt. */
  profile: JobProfile;
  model: string;
  maxTokens: number;
  effort: Effort;
  redaction: { contactInfo: boolean; name: boolean };
  signal?: AbortSignal;
  onStage?: (stage: ScreeningStage) => void;
}

export interface ScreeningOutcome {
  result: ScreeningResult;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

/** The first appearance of these keys in the streamed assessment JSON marks real progress through the schema. */
const STAGE_MARKERS: [RegExp, ScreeningStage][] = [
  [/(?<!\\)"matchedSkills"\s*:/, "comparing_qualifications"],
  [/(?<!\\)"criteria"\s*:/, "evaluating_criteria"],
  [/(?<!\\)"missingInformation"\s*:/, "identifying_missing"],
  [/(?<!\\)"overallAssessment"\s*:/, "preparing_report"],
];

export const MAX_RESUME_CHARS = 200_000;

export function toScreeningRequest(profile: JobProfile, candidate: { name?: string; resumeText: string }): ScreeningRequest {
  const by = (i: ScreeningCriterion["importance"]) => profile.criteria.filter((c) => c.importance === i);
  return {
    candidate,
    jobProfile: {
      title: profile.title,
      description: profile.description,
      requiredCriteria: by("required"),
      importantCriteria: by("important"),
      preferredCriteria: by("preferred"),
    },
  };
}

export async function screenCandidate(req: ScreeningRequest, opts: ScreeningOptions): Promise<ScreeningOutcome> {
  const started = Date.now();
  const text = req.candidate.resumeText.trim();
  if (!text) throw new AppError("EMPTY_RESUME", "This candidate has no resume text. Upload a resume or paste the text before screening.");
  if (text.length > MAX_RESUME_CHARS)
    throw new AppError("VALIDATION", "This resume is unusually long (over 200,000 characters). Please check the extracted text.");
  const configured = [
    ...req.jobProfile.requiredCriteria,
    ...req.jobProfile.importantCriteria,
    ...req.jobProfile.preferredCriteria,
  ];
  if (configured.length === 0)
    throw new AppError("VALIDATION", "The job profile has no screening criteria. Add at least one criterion before screening.");

  opts.onStage?.("reading_resume");
  const resumeForClaude = redactResume(text, {
    contactInfo: opts.redaction.contactInfo,
    name: opts.redaction.name,
    candidateName: req.candidate.name,
  });

  const profile: JobProfile = { ...opts.profile, criteria: configured };
  const prompt = (part: "profile" | "assessment") =>
    buildScreeningUserPrompt({ jobProfile: profile, resumeText: resumeForClaude, screeningDate: new Date().toISOString().slice(0, 10), part });
  const common = { model: opts.model, maxTokens: opts.maxTokens, effort: opts.effort, system: SCREENING_SYSTEM_PROMPT, signal: opts.signal };

  // Two requests in parallel (the API caps the complexity of a single output schema).
  // If either fails, cancel the other so no work is wasted.
  const pending = [...STAGE_MARKERS];
  const inner = new AbortController();
  const abortInner = () => inner.abort();
  opts.signal?.addEventListener("abort", abortInner);
  opts.onStage?.("extracting_info");
  let profileRes: Awaited<ReturnType<typeof runStructured>>;
  let assessmentRes: Awaited<ReturnType<typeof runStructured>>;
  try {
    [profileRes, assessmentRes] = await Promise.all(
      [
        runStructured({ ...common, signal: inner.signal, user: prompt("profile"), format: profileOutputFormat }),
        runStructured({
          ...common,
          signal: inner.signal,
          user: prompt("assessment"),
          format: assessmentOutputFormat,
          onText: (acc) => {
            while (pending.length && pending[0][0].test(acc)) opts.onStage?.(pending.shift()![1]);
          },
        }),
      ].map((p) =>
        p.catch((e: unknown) => {
          inner.abort();
          throw e;
        }),
      ),
    );
  } catch (e) {
    // Report the original failure, not the cancellation it caused in the sibling request.
    throw opts.signal?.aborted ? new AppError("CANCELLED", "Screening was cancelled. Your candidate information has not been deleted.") : e;
  } finally {
    opts.signal?.removeEventListener("abort", abortInner);
  }
  // Any stages the assessment stream didn't mark (e.g. fallback path) are complete now.
  for (const [, stage] of pending) opts.onStage?.(stage);

  opts.onStage?.("validating");
  const output = validateScreeningOutput([profileRes.text, assessmentRes.text], configured);
  return {
    result: { ...output, generatedAt: new Date().toISOString(), model: assessmentRes.model, promptVersion: PROMPT_VERSION },
    usage: {
      inputTokens: profileRes.usage.inputTokens + assessmentRes.usage.inputTokens,
      outputTokens: profileRes.usage.outputTokens + assessmentRes.usage.outputTokens,
    },
    durationMs: Date.now() - started,
  };
}
