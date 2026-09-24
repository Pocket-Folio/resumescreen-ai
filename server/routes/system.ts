import { Router } from "express";
import type { Store } from "../db";
import { DB_FILE } from "../db";
import { config, saveApiKey } from "../config";
import { AppError } from "../errors";
import { authEnabled } from "../auth";
import { loadDemoData } from "../demo/demoData";
import { PROMPT_VERSION } from "../services/claude/prompts/screenCandidate";
import type { SystemInfo } from "../../shared/types";

export function systemRoutes(store: Store): Router {
  const r = Router();

  r.get("/system", (_req, res) => {
    const info: SystemInfo = {
      dataDir: config.dataDir,
      databaseFile: DB_FILE,
      databaseSizeBytes: store.sizeBytes(),
      authEnabled: authEnabled(),
      version: config.version,
      promptVersion: PROMPT_VERSION,
      counts: store.counts(),
    };
    res.json(info);
  });

  r.get("/audit", (req, res) => {
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit ?? 500)));
    res.json(store.listAudit(limit));
  });

  r.post("/demo", (_req, res) => {
    const counts = loadDemoData(store);
    store.audit("demo.loaded", "system", null, `Demo data loaded (${counts.jobProfiles} job profiles, ${counts.candidates} candidates)`);
    res.json(counts);
  });

  r.delete("/demo", (_req, res) => {
    store.deleteDemoData();
    store.audit("demo.deleted", "system", null, "Demo data deleted");
    res.json({ ok: true });
  });

  r.post("/data/delete-all", (req, res) => {
    if (req.body?.confirm !== "DELETE") throw new AppError("VALIDATION", "Type DELETE to confirm.");
    const resetSettings = req.body?.resetSettings === true;
    store.deleteAllData(resetSettings);
    if (resetSettings) saveApiKey(null);
    store.audit("data.deleted_all", "system", null, `All local data deleted${resetSettings ? " (settings and saved API key reset)" : ""}`);
    res.json({ ok: true });
  });

  return r;
}
