import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import type { Store } from "../db";
import { newId, now } from "../db";
import { config } from "../config";
import { AppError, notFound } from "../errors";
import { log } from "../logger";
import { detectType, extractContactInfo, normalizeText, parseResume } from "../services/resumeParser";
import { extractWithClaude } from "../services/claude/extractDocument";
import { candidateUpdateInput, hrReviewInput, manualCandidateInput, parseBody } from "../validation";
import { summarizeScreening } from "../../shared/screeningUtils";
import type { Candidate, CandidateListItem, ResumeFileInfo } from "../../shared/types";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

/** Multer wrapper that turns size errors into a friendly message. */
const singleFile = (field: string) => (req: Request, res: Response, next: NextFunction) =>
  upload.single(field)(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("FILE_TOO_LARGE", `The file is larger than the ${config.maxUploadBytes / 1024 / 1024} MB limit.`));
    }
    next(err);
  });

const fileNameToName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(resume|cv|curriculum vitae)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

/** File type for a file whose extraction failed (detectType may itself throw). */
function safeType(fileName: string, buf: Buffer): ResumeFileInfo["type"] {
  try {
    return detectType(fileName, buf);
  } catch {
    return "txt";
  }
}

export function candidateRoutes(store: Store): Router {
  const r = Router();

  const toListItem = (c: Candidate, jobTitles: Map<string, string>): CandidateListItem => {
    const { resumeText: _omit, ...rest } = c;
    const latest = c.latestScreeningId ? store.getScreening(c.latestScreeningId) : null;
    return {
      ...rest,
      jobTitle: c.jobProfileId ? (jobTitles.get(c.jobProfileId) ?? null) : null,
      latest: latest ? summarizeScreening(latest) : null,
    };
  };

  r.get("/", (_req, res) => {
    const titles = new Map(store.listJobProfiles().map((j) => [j.id, j.title]));
    res.json(store.listCandidates().map((c) => toListItem(c, titles)));
  });

  r.get("/:id", (req, res) => {
    const c = store.getCandidate(String(req.params.id));
    if (!c) throw notFound("Candidate");
    res.json({ candidate: c, screenings: store.listScreenings(c.id) });
  });

  /** Upload one resume file. Unreadable files still create a candidate so HR can retry or paste text. */
  r.post("/upload", singleFile("file"), async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError("VALIDATION", "No file was received.");
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const jobProfileId = typeof req.body?.jobProfileId === "string" && req.body.jobProfileId ? req.body.jobProfileId : null;
    if (jobProfileId && !store.getJobProfile(jobProfileId)) throw notFound("Job profile");
    const t = now();
    const base: Candidate = {
      id: newId("cand"),
      jobProfileId,
      name: fileNameToName(fileName) || "Unnamed candidate",
      email: "",
      phone: "",
      location: "",
      links: [],
      resumeText: "",
      file: { name: fileName, size: file.size, type: "txt", uploadedAt: t },
      extraction: { status: "success", error: null, warnings: [] },
      screeningStatus: "not_screened",
      hrReview: null,
      latestScreeningId: null,
      isDemo: false,
      createdAt: t,
      updatedAt: t,
    };
    try {
      const parsed = await parseResume(fileName, file.buffer);
      const c: Candidate = {
        ...base,
        name: parsed.name || base.name,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        links: parsed.links,
        resumeText: parsed.text,
        file: { ...base.file!, type: parsed.type },
        extraction: { status: "success", error: null, warnings: parsed.warnings, method: parsed.method },
      };
      store.saveCandidate(c);
      store.audit(
        "candidate.uploaded",
        "candidate",
        c.id,
        `Resume uploaded (${parsed.type.toUpperCase()}, ${Math.round(file.size / 1024)} KB); text extracted${parsed.method === "ocr" ? " with local OCR" : ""}`,
      );
      res.status(201).json(c);
    } catch (e) {
      if (!(e instanceof AppError) || (e.code !== "EXTRACTION_FAILED" && e.code !== "EMPTY_RESUME")) throw e;
      const c: Candidate = {
        ...base,
        file: { ...base.file!, type: safeType(fileName, file.buffer) },
        extraction: { status: "failed", error: e.message, warnings: [] },
      };
      store.saveCandidate(c);
      store.audit("candidate.uploaded", "candidate", c.id, `Resume uploaded; text extraction failed (${e.code})`);
      log.warn("resume extraction failed", { candidate: c.id, code: e.code });
      res.status(201).json(c);
    }
  });

  /** Retry extraction for an existing candidate with a (possibly different) file. */
  r.post("/:id/reextract", singleFile("file"), async (req, res) => {
    const c = store.getCandidate(String(req.params.id));
    if (!c) throw notFound("Candidate");
    const file = req.file;
    if (!file) throw new AppError("VALIDATION", "No file was received.");
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const useClaude = req.body?.method === "claude";
    let parsed: Awaited<ReturnType<typeof parseResume>>;
    if (useClaude) {
      const type = detectType(fileName, file.buffer);
      store.audit("candidate.claude_extraction", "candidate", c.id, `Resume file (${type.toUpperCase()}) sent to Claude API for text extraction`);
      const text = await extractWithClaude(file.buffer, type, fileName, store.getSettings().model);
      parsed = { text, type, method: "text", warnings: ["Text was read by Claude from the scanned file. Please check it before screening."], ...extractContactInfo(text) };
    } else {
      parsed = await parseResume(fileName, file.buffer);
    }
    const updated: Candidate = {
      ...c,
      name: c.extraction.status === "failed" && parsed.name ? parsed.name : c.name,
      email: c.email || parsed.email,
      phone: c.phone || parsed.phone,
      location: c.location || parsed.location,
      links: c.links.length ? c.links : parsed.links,
      resumeText: parsed.text,
      file: { name: fileName, size: file.size, type: parsed.type, uploadedAt: now() },
      extraction: { status: "success", error: null, warnings: parsed.warnings, method: useClaude ? "claude" : parsed.method },
      updatedAt: now(),
    };
    store.saveCandidate(updated);
    store.audit("candidate.reextracted", "candidate", c.id, `Resume text re-extracted (${parsed.type.toUpperCase()}${useClaude ? ", read by Claude" : parsed.method === "ocr" ? ", local OCR" : ""})`);
    res.json(updated);
  });

  /** Create a candidate from pasted resume text. */
  r.post("/", (req, res) => {
    const input = parseBody(manualCandidateInput, req.body);
    if (input.jobProfileId && !store.getJobProfile(input.jobProfileId)) throw notFound("Job profile");
    const text = normalizeText(input.resumeText);
    const info = extractContactInfo(text);
    const t = now();
    const c: Candidate = {
      id: newId("cand"),
      jobProfileId: input.jobProfileId,
      name: input.name || info.name || "Unnamed candidate",
      email: info.email,
      phone: info.phone,
      location: info.location,
      links: info.links,
      resumeText: text,
      file: { name: "Pasted text", size: Buffer.byteLength(text), type: "manual", uploadedAt: t },
      extraction: { status: "manual", error: null, warnings: [] },
      screeningStatus: "not_screened",
      hrReview: null,
      latestScreeningId: null,
      isDemo: false,
      createdAt: t,
      updatedAt: t,
    };
    store.saveCandidate(c);
    store.audit("candidate.created", "candidate", c.id, "Candidate created from pasted resume text");
    res.status(201).json(c);
  });

  r.put("/:id", (req, res) => {
    const c = store.getCandidate(String(req.params.id));
    if (!c) throw notFound("Candidate");
    const input = parseBody(candidateUpdateInput, req.body);
    if (input.jobProfileId && !store.getJobProfile(input.jobProfileId)) throw notFound("Job profile");
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as typeof input;
    const updated: Candidate = { ...c, ...patch, updatedAt: now() };
    if (input.resumeText !== undefined) {
      updated.resumeText = normalizeText(input.resumeText);
      if (updated.resumeText && c.extraction.status === "failed") {
        updated.extraction = { status: "manual", error: null, warnings: [] };
      }
    }
    store.saveCandidate(updated);
    store.audit("candidate.updated", "candidate", c.id, `Candidate details updated (${Object.keys(input).join(", ")})`);
    res.json(updated);
  });

  r.put("/:id/review", (req, res) => {
    const c = store.getCandidate(String(req.params.id));
    if (!c) throw notFound("Candidate");
    const input = parseBody(hrReviewInput, req.body);
    const updated: Candidate = { ...c, hrReview: { ...input, updatedAt: now() }, updatedAt: now() };
    store.saveCandidate(updated);
    store.audit(
      "review.saved",
      "candidate",
      c.id,
      `HR review saved by ${input.reviewer} (status: ${input.status}${input.decision ? `, decision: ${input.decision}` : ""})`,
    );
    res.json(updated);
  });

  r.delete("/:id", (req, res) => {
    const c = store.getCandidate(String(req.params.id));
    if (!c) throw notFound("Candidate");
    store.deleteCandidate(c.id);
    store.audit("candidate.deleted", "candidate", c.id, "Candidate data deleted (resume text, screenings and HR notes)");
    res.json({ ok: true });
  });

  return r;
}
