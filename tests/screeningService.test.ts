import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreeningStage } from "../shared/types";
import { backendProfile, validOutput } from "./helpers";

const { runStructured } = vi.hoisted(() => ({ runStructured: vi.fn() }));
vi.mock("../server/services/claude/claudeClient", () => ({ runStructured }));

const { screenCandidate, toScreeningRequest } = await import("../server/services/claude/screeningService");

const opts = (onStage?: (s: ScreeningStage) => void) => ({
  profile: backendProfile,
  model: "claude-opus-5",
  maxTokens: 16000,
  effort: "high" as const,
  redaction: { contactInfo: true, name: true },
  onStage,
});

describe("screenCandidate", () => {
  beforeEach(() => runStructured.mockReset());

  it("returns a validated result with metadata and reports progress in order", async () => {
    const text = JSON.stringify(validOutput());
    runStructured.mockImplementation(async (req?: { onText?: (s: string) => void }) => {
      req?.onText?.(text);
      return { text, model: "claude-opus-5", usage: { inputTokens: 10, outputTokens: 20 } };
    });
    const stages: ScreeningStage[] = [];
    const out = await screenCandidate(
      toScreeningRequest(backendProfile, { name: "Jane Doe", resumeText: "Jane Doe\njane@example.com\nPython developer" }),
      opts((s) => stages.push(s)),
    );
    expect(out.result.promptVersion).toMatch(/^screen-candidate\//);
    expect(out.result.model).toBe("claude-opus-5");
    expect(stages).toEqual([
      "reading_resume",
      "extracting_info",
      "comparing_qualifications",
      "evaluating_criteria",
      "identifying_missing",
      "preparing_report",
      "validating",
    ]);
    // Two requests (profile + assessment), both redacted.
    expect(runStructured).toHaveBeenCalledTimes(2);
    expect(runStructured.mock.calls[0][0].user).toMatch(/only the candidate profile/);
    const sent = runStructured.mock.calls[1][0].user as string;
    expect(sent).not.toContain("Jane");
    expect(sent).not.toContain("jane@example.com");
    expect(sent).toContain("[CANDIDATE]");
  });

  it("surfaces malformed output as an error instead of a result", async () => {
    runStructured.mockResolvedValue({ text: "not json", model: "m", usage: { inputTokens: 1, outputTokens: 1 } });
    await expect(screenCandidate(toScreeningRequest(backendProfile, { resumeText: "Resume" }), opts())).rejects.toMatchObject({ code: "MALFORMED_JSON" });
  });

  it("refuses to send an empty resume", async () => {
    await expect(screenCandidate(toScreeningRequest(backendProfile, { resumeText: "   " }), opts())).rejects.toMatchObject({ code: "EMPTY_RESUME" });
    expect(runStructured).not.toHaveBeenCalled();
  });
});
