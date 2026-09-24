import { describe, expect, it } from "vitest";
import { assessmentOutputFormat, profileOutputFormat, validateScreeningOutput } from "../server/services/claude/schemas";
import { AppError } from "../server/errors";
import { backendProfile, validOutput } from "./helpers";

const criteria = backendProfile.criteria;

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : "OTHER";
  }
  return undefined;
}

describe("Claude response validation", () => {
  it("accepts a schema-valid response", () => {
    const r = validateScreeningOutput(JSON.stringify(validOutput()), criteria);
    expect(r.criteria).toHaveLength(criteria.length);
  });

  it("rejects malformed JSON", () => {
    expect(codeOf(() => validateScreeningOutput('{"candidateSummary": "cut off', criteria))).toBe("MALFORMED_JSON");
    expect(codeOf(() => validateScreeningOutput("Here is my assessment: strong!", criteria))).toBe("MALFORMED_JSON");
  });

  it("rejects JSON that does not match the schema", () => {
    const bad = { ...validOutput(), overallAssessment: "hire" };
    expect(codeOf(() => validateScreeningOutput(JSON.stringify(bad), criteria))).toBe("INVALID_RESPONSE");
    const missingField: Record<string, unknown> = { ...validOutput() };
    delete missingField.missingInformation;
    expect(codeOf(() => validateScreeningOutput(JSON.stringify(missingField), criteria))).toBe("INVALID_RESPONSE");
    const badStatus = validOutput();
    (badStatus.criteria[0] as { status: string }).status = "excellent";
    expect(codeOf(() => validateScreeningOutput(JSON.stringify(badStatus), criteria))).toBe("INVALID_RESPONSE");
  });

  it("rejects responses that skip a configured criterion", () => {
    const o = validOutput();
    o.criteria = o.criteria.slice(1);
    expect(codeOf(() => validateScreeningOutput(JSON.stringify(o), criteria))).toBe("INVALID_RESPONSE");
  });

  it("re-orders criteria and keeps HR's wording and importance", () => {
    const o = validOutput();
    o.criteria.reverse();
    o.criteria[o.criteria.length - 1].criterion = "  python ";
    o.criteria[o.criteria.length - 1].importance = "preferred";
    const r = validateScreeningOutput(JSON.stringify(o), criteria);
    expect(r.criteria[0].criterion).toBe("Python");
    expect(r.criteria[0].importance).toBe("required");
  });

  it("sends two strict JSON schemas (no extra properties allowed)", () => {
    const p = profileOutputFormat.schema as { additionalProperties: boolean; required: string[] };
    const a = assessmentOutputFormat.schema as { additionalProperties: boolean; required: string[] };
    expect(profileOutputFormat.type).toBe("json_schema");
    expect(p.additionalProperties).toBe(false);
    expect(a.additionalProperties).toBe(false);
    expect(p.required).toEqual(["candidateProfile", "candidateSummary"]);
    expect(a.required).toContain("criteria");
    expect(a.required.at(-1)).toBe("overallRationale");
  });

  it("merges and validates the profile and assessment responses", () => {
    const { candidateProfile, candidateSummary, ...assessment } = validOutput();
    const r = validateScreeningOutput([JSON.stringify({ candidateProfile, candidateSummary }), JSON.stringify(assessment)], criteria);
    expect(r.candidateSummary).toBe(candidateSummary);
    expect(r.criteria).toHaveLength(criteria.length);
    // A missing half is rejected.
    expect(codeOf(() => validateScreeningOutput([JSON.stringify(assessment)], criteria))).toBe("INVALID_RESPONSE");
  });

  it("accepts JSON wrapped in a code fence (prompt-based fallback)", () => {
    const r = validateScreeningOutput("```json\n" + JSON.stringify(validOutput()) + "\n```", criteria);
    expect(r.overallAssessment).toBe("insufficient_information");
  });
});
