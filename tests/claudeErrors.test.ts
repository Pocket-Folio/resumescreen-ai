import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { toAppError, getClient } from "../server/services/claude/claudeClient";

const apiError = (status: number) => Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: "m" } }, "m", new Headers());

describe("Claude error mapping", () => {
  it.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [429, "RATE_LIMITED"],
    [404, "API_ERROR"],
    [400, "API_ERROR"],
    [529, "OVERLOADED"],
    [500, "API_ERROR"],
  ])("maps HTTP %i to %s", (status, code) => {
    expect(toAppError(apiError(status)).code).toBe(code);
  });

  it("maps timeouts, network failures and cancellation", () => {
    expect(toAppError(new Anthropic.APIConnectionTimeoutError()).code).toBe("TIMEOUT");
    expect(toAppError(new Anthropic.APIConnectionError({ message: "down" })).code).toBe("NETWORK");
    expect(toAppError(new Anthropic.APIUserAbortError()).code).toBe("CANCELLED");
  });

  it("tells HR their data is safe", () => {
    expect(toAppError(apiError(500)).message).toMatch(/has not been deleted/);
  });

  it("reports a missing API key clearly", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getClient()).toThrow(/not been configured/);
  });
});
