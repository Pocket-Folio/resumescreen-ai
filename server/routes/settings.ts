import { Router } from "express";
import type { Store } from "../db";
import { now } from "../db";
import { getApiKey, getWorkspaceId, maskKey, saveApiKey, saveWorkspaceId } from "../config";
import { AppError } from "../errors";
import { parseBody, settingsInput } from "../validation";
import { testConnection } from "../services/claude/claudeClient";
import type { ApiKeyStatus } from "../../shared/types";

function keyStatus(): ApiKeyStatus {
  const { key, source } = getApiKey();
  const ws = getWorkspaceId();
  return { configured: Boolean(key), source, masked: key ? maskKey(key) : null, workspaceId: ws.id, workspaceSource: ws.source };
}

export function settingsRoutes(store: Store): Router {
  const r = Router();

  r.get("/", (_req, res) => {
    res.json({ settings: store.getSettings(), apiKey: keyStatus() });
  });

  r.put("/", (req, res) => {
    const input = parseBody(settingsInput, req.body);
    const saved = store.saveSettings({ ...store.getSettings(), ...input });
    store.audit("settings.updated", "settings", null, `Settings updated (model: ${saved.model}, max tokens: ${saved.maxTokens})`);
    res.json({ settings: saved, apiKey: keyStatus() });
  });

  r.put("/api-key", (req, res) => {
    if (getApiKey().source === "environment") {
      throw new AppError("VALIDATION", "The API key is set by the server environment (ANTHROPIC_API_KEY) and cannot be changed here.");
    }
    const key = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) {
      throw new AppError("VALIDATION", "That does not look like a Claude API key. Keys start with “sk-ant-”.");
    }
    saveApiKey(key);
    store.audit("settings.api_key_saved", "settings", null, "Claude API key saved");
    res.json({ apiKey: keyStatus() });
  });

  r.put("/workspace", (req, res) => {
    if (getWorkspaceId().source === "environment") {
      throw new AppError("VALIDATION", "The Workspace ID is set by the server environment (ANTHROPIC_WORKSPACE_ID) and cannot be changed here.");
    }
    const id = typeof req.body?.workspaceId === "string" ? req.body.workspaceId.trim() : "";
    if (id && !/^wrkspc_[A-Za-z0-9_-]{4,100}$/.test(id)) {
      throw new AppError(
        "VALIDATION",
        `"${id.slice(0, 40)}" looks like a workspace name. Enter the workspace ID, which starts with "wrkspc_" — or create a new API key inside the workspace instead.`,
      );
    }
    saveWorkspaceId(id || null);
    store.audit("settings.workspace_saved", "settings", null, id ? "Claude workspace ID saved" : "Claude workspace ID removed");
    res.json({ apiKey: keyStatus() });
  });

  r.delete("/api-key", (_req, res) => {
    if (getApiKey().source === "environment") {
      throw new AppError("VALIDATION", "The API key is set by the server environment and cannot be removed here.");
    }
    saveApiKey(null);
    store.audit("settings.api_key_removed", "settings", null, "Claude API key removed");
    res.json({ apiKey: keyStatus() });
  });

  r.post("/test-connection", async (req, res) => {
    const model = typeof req.body?.model === "string" && req.body.model ? req.body.model : store.getSettings().model;
    const result = await testConnection(model);
    res.json(result);
  });

  r.post("/privacy-acknowledge", (_req, res) => {
    const s = store.saveSettings({ ...store.getSettings(), privacyNoticeAcknowledgedAt: now() });
    store.audit("privacy.acknowledged", "settings", null, "Screening privacy notice acknowledged");
    res.json({ settings: s, apiKey: keyStatus() });
  });

  return r;
}
