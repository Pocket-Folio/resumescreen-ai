import type { AssessmentStatus, OverallAssessment } from "../../shared/screeningSchema";
import type { CriterionCategory, EmploymentType, HRDecision, Importance, ReviewStatus, ScreeningStatus, ScreeningStage } from "../../shared/types";
import type { Tone } from "../components/ui/Badge";

export const ALIGNMENT: Record<OverallAssessment, { label: string; tone: Tone; description: string }> = {
  strong_alignment: { label: "Strong Alignment", tone: "green", description: "Resume shows most required and important criteria with explicit evidence." },
  moderate_alignment: { label: "Moderate Alignment", tone: "yellow", description: "Resume shows many criteria, with some gaps or items needing verification." },
  limited_alignment: { label: "Limited Alignment", tone: "red", description: "Resume evidence shows several required criteria are not or only partly met." },
  insufficient_information: { label: "Insufficient Information", tone: "gray", description: "The resume lacks the information needed to assess several required criteria." },
};

export const ASSESSMENT: Record<AssessmentStatus, { label: string; tone: Tone }> = {
  meets: { label: "Meets", tone: "green" },
  partially_meets: { label: "Partially Meets", tone: "yellow" },
  does_not_meet: { label: "Does Not Meet", tone: "red" },
  unclear: { label: "Unclear", tone: "purple" },
  not_found: { label: "Not Found", tone: "gray" },
};

export const IMPORTANCE: Record<Importance, { label: string; tone: Tone }> = {
  required: { label: "Required", tone: "indigo" },
  important: { label: "Important", tone: "blue" },
  preferred: { label: "Preferred", tone: "gray" },
};

export const SCREENING_STATUS: Record<ScreeningStatus, { label: string; tone: Tone }> = {
  not_screened: { label: "Not Screened", tone: "gray" },
  screening: { label: "Screening", tone: "blue" },
  screened: { label: "Screened", tone: "green" },
  needs_review: { label: "Needs Review", tone: "yellow" },
};

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not Reviewed", tone: "gray" },
  in_progress: { label: "Review In Progress", tone: "blue" },
  completed: { label: "HR Reviewed", tone: "purple" },
};

export const DECISION: Record<HRDecision, { label: string; tone: Tone }> = {
  continue_review: { label: "Continue Review", tone: "green" },
  request_more_info: { label: "Request More Information", tone: "blue" },
  hold_for_review: { label: "Hold for Review", tone: "yellow" },
  not_progressing: { label: "Not Progressing", tone: "gray" },
};

export const EMPLOYMENT_TYPE: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
};

export const CATEGORY: Record<CriterionCategory, string> = {
  skill: "Skill",
  technical_skill: "Technical skill",
  experience: "Experience",
  education: "Education",
  certification: "Certification",
  industry: "Industry",
  language: "Language",
  other: "Other",
};

export const EVIDENCE_TYPE = {
  explicit: { label: "Stated in resume", tone: "green" as Tone },
  inferred: { label: "AI inference", tone: "purple" as Tone },
  absent: { label: "Not in resume", tone: "gray" as Tone },
};

export const STAGES: { id: ScreeningStage; label: string }[] = [
  { id: "reading_resume", label: "Reading resume" },
  { id: "extracting_info", label: "Extracting candidate information" },
  { id: "comparing_qualifications", label: "Comparing qualifications" },
  { id: "evaluating_criteria", label: "Evaluating required criteria" },
  { id: "identifying_missing", label: "Identifying missing information" },
  { id: "preparing_report", label: "Preparing screening report" },
  { id: "validating", label: "Validating and saving results" },
];
