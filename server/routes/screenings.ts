import { Router } from "express";
import type { Store } from "../db";
import { newId, now } from "../db";
import { AppError, notFound } from "../errors";
import { log } from "../logger";
import { screenCandidate, toScreeningRequest } from "../services/claude/screeningService";
import { PROMPT_VERSION, SCREENING_SYSTEM_PROMPT } from "../services/claude/prompts/screenCandidate";
import { screeningNeedsReview } from "../../shared/screeningUtils";
import type { ScreeningRecord, ScreeningStreamEvent } from "../../shared/types";

/** Candidates currently being screened, to prevent duplicate concurrent runs. */
const inFlight = new Set<string>();

export function screeningRoutes(store: Store): Router {
  const r = Router();

  r.get("/", (req, res) => {
    const candidateId = typeof req.query.candidateId === "string" ? req.query.candidateId : undefined;
    res.json(store.listScreenings(candidateId));
  });

  /** The fixed screening instructions, so HR can review exactly what Claude is told. */
  r.get("/prompt", (_req, res) => {
    res.json({ version: PROMPT_VERSION, systemPrompt: SCREENING_SYSTEM_PROMPT });
  });

  r.get("/:id", (req, res) => {
    const s = store.getScreening(req.params.id);
    if (!s) throw notFound("Screening");
    res.json(s);
  });

  /**
   * Runs a screening and streams progress as newline-delimited JSON (ScreeningStreamEvent).
   * This is the ONLY place candidate data leaves the server, and only after HR clicks "Run Screening".
   */
  r.post("/", async (req, res) => {
    const candidateId = String(req.body?.candidateId ?? "");
    const jobProfileId = String(req.body?.jobProfileId ?? "");
    const candidate = store.getCandidate(candidateId);
    if (!candidate) throw notFound("Candidate");
    const profile = store.getJobProfile(jobProfileId);
    if (!profile) throw notFound("Job profile");
    if (inFlight.has(candidate.id)) throw new AppError("VALIDATION", "A screening is already running for this candidate.");

    const settings = store.getSettings();
    const previousStatus = candidate.screeningStatus;
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    res.status(200).setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (e: ScreeningStreamEvent) => res.write(JSON.stringify(e) + "\n");

    inFlight.add(candidate.id);
    store.saveCandidate({ ...candidate, screeningStatus: "screening", updatedAt: now() });
    store.audit(
      "screening.started",
      "screening",
      candidate.id,
      `Resume text and "${profile.title}" criteria sent to Claude API (${settings.model}); contact redaction ${settings.redactContactInfo ? "on" : "off"}, name redaction ${settings.redactName ? "on" : "off"}`,
    );
    try {
      const outcome = await screenCandidate(
        toScreeningRequest(profile, { name: candidate.name, resumeText: candidate.resumeText }),
        {
          profile,
          model: settings.model,
          maxTokens: settings.maxTokens,
          effort: settings.effort,
          redaction: { contactInfo: settings.redactContactInfo, name: settings.redactName },
          signal: controller.signal,
          onStage: (stage) => send({ type: "stage", stage }),
        },
      );
      const record: ScreeningRecord = {
        id: newId("scr"),
        candidateId: candidate.id,
        jobProfileId: profile.id,
        jobProfileSnapshot: profile,
        model: outcome.result.model,
        promptVersion: PROMPT_VERSION,
        result: outcome.result,
        redaction: { contactInfo: settings.redactContactInfo, name: settings.redactName },
        usage: outcome.usage,
        durationMs: outcome.durationMs,
        isDemo: false,
        createdAt: now(),
      };
      const latest = store.getCandidate(candidate.id);
      if (!latest) {
        // Deleted while the screening was running: don't resurrect it or store orphaned results.
        throw new AppError("NOT_FOUND", "This candidate was deleted while the screening was running, so the result was discarded.");
      }
      store.insertScreening(record);
      const updated = store.saveCandidate({
        ...latest,
        jobProfileId: profile.id,
        latestScreeningId: record.id,
        screeningStatus: screeningNeedsReview(record) ? "needs_review" : "screened",
        updatedAt: now(),
      });
      store.audit(
        "screening.completed",
        "screening",
        record.id,
        `Screening completed against "${profile.title}" (${record.model}, ${PROMPT_VERSION}, ${Math.round(outcome.durationMs / 1000)}s)`,
      );
      log.info("screening completed", { screening: record.id, ms: outcome.durationMs, in: outcome.usage.inputTokens, out: outcome.usage.outputTokens });
      send({ type: "complete", screening: record, candidate: updated });
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError("INTERNAL", "An unexpected error occurred while screening. Your candidate information has not been deleted.");
      const latest = store.getCandidate(candidate.id);
      if (latest) store.saveCandidate({ ...latest, screeningStatus: previousStatus, updatedAt: now() });
      store.audit("screening.failed", "screening", candidate.id, `Screening failed (${err.code})`);
      log.warn("screening failed", { candidate: candidate.id, code: err.code });
      if (!res.writableEnded && !controller.signal.aborted) send({ type: "error", error: err.toBody() });
    } finally {
      inFlight.delete(candidate.id);
      res.end();
    }
  });

  return r;
}
