/**
 * Structured-output schema sent to Claude, and validation of what comes back.
 * Nothing is stored or shown unless it passes validateScreeningOutput().
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  assessmentOutputSchema,
  profileOutputSchema,
  screeningResultSchema,
  type ClaudeScreeningOutput,
} from "../../../shared/screeningSchema";
import type { ScreeningCriterion } from "../../../shared/types";
import { AppError } from "../../errors";

const toFormat = (schema: Parameters<typeof zodOutputFormat>[0]) => ({ type: "json_schema" as const, schema: zodOutputFormat(schema).schema });

/** JSON-schema output formats for the two screening requests (`output_config.format`). */
export const profileOutputFormat = toFormat(profileOutputSchema);
export const assessmentOutputFormat = toFormat(assessmentOutputSchema);

/** Parses a JSON response, tolerating a ```json fence (only possible on the unstructured fallback path). */
export function parseJsonText(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Validates Claude's output. Accepts one JSON text, or several (the two screening requests) to be merged. */
export function validateScreeningOutput(text: string | string[], configured: ScreeningCriterion[]): ClaudeScreeningOutput {
  let json: unknown;
  try {
    const parts = (Array.isArray(text) ? text : [text]).map(parseJsonText);
    json = parts.length === 1 ? parts[0] : Object.assign({}, ...parts);
  } catch {
    throw new AppError(
      "MALFORMED_JSON",
      "Claude returned a response that was not valid JSON, so no results are shown. Your candidate information has not been changed. Please run the screening again.",
    );
  }

  const parsed = screeningResultSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new AppError(
      "INVALID_RESPONSE",
      "Claude's response did not match the expected screening format, so no results are shown. Your candidate information has not been changed. Please run the screening again.",
      issues,
    );
  }

  // Every configured criterion must be assessed exactly once; order results to match the profile.
  const byName = new Map(parsed.data.criteria.map((c) => [norm(c.criterion), c]));
  const ordered = configured.map((c) => byName.get(norm(c.criterion)));
  const missing = configured.filter((_, i) => !ordered[i]).map((c) => c.criterion);
  if (missing.length > 0) {
    throw new AppError(
      "INVALID_RESPONSE",
      "Claude's response did not assess every configured criterion, so no results are shown. Please run the screening again.",
      `Missing assessments for: ${missing.join(", ")}`,
    );
  }
  // Keep HR's configured wording and importance as the source of truth.
  const criteria = ordered.map((a, i) => ({
    ...a!,
    criterion: configured[i].criterion,
    importance: configured[i].importance,
    requirement: configured[i].requirement,
  }));
  return { ...parsed.data, criteria };
}
