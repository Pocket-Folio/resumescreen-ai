import { demoJobProfiles } from "../server/demo/demoData";
import type { ClaudeScreeningOutput } from "../shared/screeningSchema";

export const backendProfile = demoJobProfiles[0];

/** A schema-valid Claude output for the demo backend profile. */
export function validOutput(): ClaudeScreeningOutput {
  return {
    candidateProfile: {
      currentRole: "Engineer",
      experience: [{ company: "Acme", position: "Engineer", startDate: "2019", endDate: "Present", duration: null, responsibilities: ["APIs"] }],
      education: [],
      skills: { technical: ["Python"], soft: [], tools: [], languages: [], certifications: [] },
    },
    candidateSummary: "Engineer.",
    matchedSkills: ["Python"],
    partiallyMatchedSkills: [],
    skillsNotFound: [],
    additionalSkills: [],
    experienceAnalysis: { totalApparentExperience: null, relevantExperience: null, industryExperience: null, notes: "" },
    relevantExperience: [],
    educationAssessment: [],
    certificationAssessment: [],
    criteria: backendProfile.criteria.map((c) => ({
      criterion: c.criterion,
      importance: c.importance,
      requirement: c.requirement,
      status: "not_found" as const,
      evidence: "Not mentioned.",
      source: null,
      evidenceType: "absent" as const,
      confidence: "high" as const,
      needsVerification: false,
      verificationReason: null,
    })),
    missingInformation: [],
    verificationItems: [],
    questionsForHR: [],
    limitations: [],
    overallAssessment: "insufficient_information",
    overallRationale: "Not enough information.",
  };
}
