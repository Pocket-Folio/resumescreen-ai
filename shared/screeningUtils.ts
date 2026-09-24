import type { ScreeningRecord, ScreeningSummary, JobProfile, ScreeningCriterion, Importance } from "./types";

export function summarizeScreening(s: ScreeningRecord): ScreeningSummary {
  const required = s.result.criteria.filter((c) => c.importance === "required");
  return {
    id: s.id,
    createdAt: s.createdAt,
    overallAssessment: s.result.overallAssessment,
    relevantExperience: s.result.experienceAnalysis.relevantExperience,
    matchedSkills: s.result.matchedSkills,
    requiredMet: required.filter((c) => c.status === "meets").length,
    requiredTotal: required.length,
    needsVerificationCount:
      s.result.criteria.filter((c) => c.needsVerification).length + s.result.verificationItems.length,
    missingInfoCount: s.result.missingInformation.length,
  };
}

/** A screening "needs review" when any required criterion is unclear/not found or anything needs verification. */
export function screeningNeedsReview(s: ScreeningRecord): boolean {
  return (
    s.result.overallAssessment === "insufficient_information" ||
    s.result.verificationItems.length > 0 ||
    s.result.criteria.some(
      (c) => c.needsVerification || (c.importance === "required" && (c.status === "unclear" || c.status === "not_found")),
    )
  );
}

export function criteriaByImportance(job: Pick<JobProfile, "criteria">): Record<Importance, ScreeningCriterion[]> {
  return {
    required: job.criteria.filter((c) => c.importance === "required"),
    important: job.criteria.filter((c) => c.importance === "important"),
    preferred: job.criteria.filter((c) => c.importance === "preferred"),
  };
}
