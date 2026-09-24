import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { config } from "../config";
import { AppError } from "../errors";
import { parseDocument } from "../services/resumeParser";
import { draftJobProfile } from "../services/claude/draftJobProfile";
import type { Store } from "../db";
import { newId, now } from "../db";
import { notFound } from "../errors";
import { jobProfileInput, parseBody } from "../validation";
import type { JobProfile } from "../../shared/types";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });
const singleFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single("file")(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("FILE_TOO_LARGE", `The file is larger than the ${config.maxUploadBytes / 1024 / 1024} MB limit.`));
    }
    next(err);
  });

export function jobProfileRoutes(store: Store): Router {
  const r = Router();

  /** Extracts text from an uploaded job description (PDF, DOCX, TXT or image). Stays on this server. */
  r.post("/extract-description", singleFile, async (req, res) => {
    if (!req.file) throw new AppError("VALIDATION", "No file was received.");
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const doc = await parseDocument(fileName, req.file.buffer);
    res.json({ text: doc.text, method: doc.method, warnings: doc.warnings.filter((w) => !w.startsWith("This file is a scanned")) });
  });

  /** Asks Claude to draft qualifications and criteria from a job description (no candidate data). */
  r.post("/draft", async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.slice(0, 200) : "";
    const description = typeof req.body?.description === "string" ? req.body.description : "";
    const settings = store.getSettings();
    const draft = await draftJobProfile({ title, description, model: settings.model, effort: settings.effort });
    store.audit("job_profile.drafted", "job_profile", null, `Job description for "${title || "untitled"}" sent to Claude API to draft criteria`);
    res.json(draft);
  });

  r.get("/", (_req, res) => {
    res.json(store.listJobProfiles());
  });

  r.get("/:id", (req, res) => {
    const p = store.getJobProfile(req.params.id);
    if (!p) throw notFound("Job profile");
    res.json(p);
  });

  r.post("/", (req, res) => {
    const input = parseBody(jobProfileInput, req.body);
    const t = now();
    const p: JobProfile = { ...input, id: newId("job"), isDemo: false, createdAt: t, updatedAt: t };
    store.saveJobProfile(p);
    store.audit("job_profile.created", "job_profile", p.id, `Job profile "${p.title}" created`);
    res.status(201).json(p);
  });

  r.put("/:id", (req, res) => {
    const existing = store.getJobProfile(req.params.id);
    if (!existing) throw notFound("Job profile");
    const input = parseBody(jobProfileInput, req.body);
    const p: JobProfile = { ...existing, ...input, updatedAt: now() };
    store.saveJobProfile(p);
    store.audit("job_profile.updated", "job_profile", p.id, `Job profile "${p.title}" updated`);
    res.json(p);
  });

  r.post("/:id/duplicate", (req, res) => {
    const existing = store.getJobProfile(req.params.id);
    if (!existing) throw notFound("Job profile");
    const t = now();
    const p: JobProfile = {
      ...existing,
      id: newId("job"),
      title: `${existing.title} (copy)`,
      criteria: existing.criteria.map((c) => ({ ...c, id: newId("crit") })),
      isDemo: false,
      createdAt: t,
      updatedAt: t,
    };
    store.saveJobProfile(p);
    store.audit("job_profile.created", "job_profile", p.id, `Job profile "${p.title}" duplicated`);
    res.status(201).json(p);
  });

  r.delete("/:id", (req, res) => {
    const existing = store.getJobProfile(req.params.id);
    if (!existing) throw notFound("Job profile");
    store.deleteJobProfile(existing.id);
    store.audit("job_profile.deleted", "job_profile", existing.id, `Job profile "${existing.title}" deleted`);
    res.json({ ok: true });
  });

  return r;
}
