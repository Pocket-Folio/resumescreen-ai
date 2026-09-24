/**
 * Thin wrapper around the Anthropic SDK. All Claude traffic goes through this module; the API key
 * is read on the server and never leaves it.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey, getWorkspaceId } from "../../config";
import { AppError } from "../../errors";
import { log } from "../../logger";
import type { Effort } from "../../../shared/types";

const TIMEOUT_MS = 5 * 60 * 1000;

export function getClient(): Anthropic {
  const { key } = getApiKey();
  if (!key) {
    throw new AppError(
      "NOT_CONFIGURED",
      "The Claude API key has not been configured. An administrator can add it in Settings → Claude API.",
    );
  }
  const workspace = getWorkspaceId().id;
  return new Anthropic({
    apiKey: key,
    timeout: TIMEOUT_MS,
    maxRetries: 2,
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  });
}

/** Translates SDK/network errors into messages HR users can act on. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const keep = " Your candidate information has not been deleted.";
  if (e instanceof Anthropic.APIUserAbortError) return new AppError("CANCELLED", "Screening was cancelled." + keep);
  if (e instanceof Anthropic.APIConnectionTimeoutError)
    return new AppError("TIMEOUT", "The Claude API took too long to respond." + keep + " Please try again.");
  if (e instanceof Anthropic.APIConnectionError)
    return new AppError(
      "NETWORK",
      "The server could not reach the Claude API. Check the internet connection of the server running ResumeScreen AI." + keep,
    );
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AppError(
      "AUTH_FAILED",
      "The Claude API rejected the configured API key. An administrator should check the key in Settings → Claude API." + keep,
    );
  if (e instanceof Anthropic.RateLimitError)
    return new AppError("RATE_LIMITED", "The Claude API rate limit was reached. Please wait a minute and try again." + keep);
  if (e instanceof Anthropic.NotFoundError)
    return new AppError("API_ERROR", "The selected Claude model is not available for this API key. Choose another model in Settings." + keep);
  if (e instanceof Anthropic.BadRequestError) {
    if (/anthropic-workspace-id/i.test(e.message)) {
      return new AppError(
        "NOT_CONFIGURED",
        "This API key is not tied to a Claude workspace. Enter your Workspace ID in Settings → Claude API (find it in the Claude Console under Settings → Workspaces), or create a workspace-scoped API key." + keep,
      );
    }
    if (/workspace/i.test(e.message) && /invalid|not found|does not exist/i.test(e.message)) {
      return new AppError("NOT_CONFIGURED", "The Workspace ID in Settings was not accepted. Check it in the Claude Console." + keep, e.message);
    }
    return new AppError("API_ERROR", "The Claude API could not process this request." + keep, e.message);
  }
  if (e instanceof Anthropic.APIError) {
    if (e.status === 529 || e.status === 503)
      return new AppError("OVERLOADED", "The Claude API is temporarily overloaded. Please try again in a few minutes." + keep);
    return new AppError(
      "API_ERROR",
      "Screening could not be completed because the Claude API request failed." + keep + " Please try again.",
      `HTTP ${e.status ?? "?"}`,
    );
  }
  return new AppError("INTERNAL", "An unexpected error occurred while screening." + keep, (e as Error)?.message);
}

/** Model-specific request options (thinking/effort support differs by model). */
export function modelOptions(model: string, effort: Effort) {
  if (model.startsWith("claude-haiku")) return { thinking: undefined, effort: undefined };
  return { thinking: { type: "adaptive" as const }, effort };
}

/** Models that support server-side refusal fallbacks (disable with CLAUDE_REFUSAL_FALLBACKS=false). */
const FALLBACK_MODELS = new Set(["claude-opus-5", "claude-fable-5-1"]);
const fallbacksEnabled = process.env.CLAUDE_REFUSAL_FALLBACKS !== "false";

export interface StructuredRequest {
  model: string;
  maxTokens: number;
  effort: Effort;
  system: string;
  user: string;
  format: { type: "json_schema"; schema: Record<string, unknown> };
  signal?: AbortSignal;
  onText?: (accumulated: string) => void;
}

export interface StructuredResponse {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const isGrammarLimit = (e: unknown) => e instanceof Anthropic.BadRequestError && /grammar is too large|schema is too (large|complex)/i.test(e.message);

/**
 * Runs a request with a strict output schema. If the API rejects the schema as too complex
 * (limits vary by model), it retries once without the constraint and asks for the same JSON in
 * the prompt instead. Callers validate the result either way.
 */
export async function runStructured(req: StructuredRequest): Promise<StructuredResponse> {
  try {
    return await runStructuredOnce(req, true);
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== "SCHEMA_TOO_LARGE") throw e;
    return runStructuredOnce(
      {
        ...req,
        user: `${req.user}\n\nRespond with only a JSON object (no prose, no code fences) that conforms exactly to this JSON schema:\n${JSON.stringify(req.format.schema)}`,
      },
      false,
    );
  }
}

async function runStructuredOnce(req: StructuredRequest, constrained: boolean): Promise<StructuredResponse> {
  const client = getClient();
  const { thinking, effort } = modelOptions(req.model, req.effort);
  const useFallbacks = fallbacksEnabled && FALLBACK_MODELS.has(req.model);
  try {
    const stream = client.beta.messages.stream(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        ...(thinking ? { thinking } : {}),
        ...(constrained || effort ? { output_config: { ...(constrained ? { format: req.format } : {}), ...(effort ? { effort } : {}) } } : {}),
        ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        // The system prompt is identical for every screening, so cache it.
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
      },
      { signal: req.signal },
    );
    let acc = "";
    stream.on("text", (delta) => {
      acc += delta;
      req.onText?.(acc);
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new AppError(
        "REFUSED",
        "Claude declined to complete this screening. Your candidate information has not been deleted. Review the resume text for unusual content and try again, or screen this candidate manually.",
        msg.stop_details?.category ?? undefined,
      );
    }
    if (msg.stop_reason === "max_tokens") {
      throw new AppError(
        "TRUNCATED",
        "Claude's response was cut off before it finished, so no results are shown. An administrator can increase “Maximum tokens” in Settings. Your candidate information has not been deleted.",
      );
    }
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return {
      text,
      model: msg.model,
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
    };
  } catch (e) {
    if (req.signal?.aborted) throw new AppError("CANCELLED", "Screening was cancelled. Your candidate information has not been deleted.");
    if (constrained && isGrammarLimit(e)) {
      log.warn("output schema too complex for strict mode; retrying with prompt-based JSON", { model: req.model });
      throw new AppError("SCHEMA_TOO_LARGE", "Output schema too complex.");
    }
    throw toAppError(e);
  }
}

/** Verifies the key works and the chosen model is available. Sends no candidate data. */
export async function testConnection(model: string): Promise<{ ok: true; model: string; displayName: string }> {
  const client = getClient();
  try {
    const m = await client.models.retrieve(model, {}, { timeout: 20_000, maxRetries: 0 });
    return { ok: true, model: m.id, displayName: m.display_name };
  } catch (e) {
    // No candidate data is involved in a connection test, so drop the reassurance suffix.
    const err = toAppError(e);
    throw new AppError(err.code, err.message.replace(/ Your candidate information has not been deleted\.?/, ""), err.detail);
  }
}
