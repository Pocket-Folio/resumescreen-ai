import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const env = process.env;

export const isProduction = env.NODE_ENV === "production";

export const config = {
  port: Number(env.PORT ?? 8080),
  dataDir: path.resolve(env.DATA_DIR ?? "./data"),
  maxUploadBytes: Math.max(1, Number(env.MAX_UPLOAD_MB ?? 10)) * 1024 * 1024,
  appPassword: env.APP_PASSWORD?.trim() || null,
  allowUnauthenticated: env.ALLOW_UNAUTHENTICATED === "true",
  cookieSecure: env.COOKIE_SECURE === "true",
  envApiKey: env.ANTHROPIC_API_KEY?.trim() || null,
  envWorkspaceId: env.ANTHROPIC_WORKSPACE_ID?.trim() || null,
  defaultModel: env.CLAUDE_MODEL?.trim() || "claude-opus-5",
  version: "1.0.0",
};

fs.mkdirSync(config.dataDir, { recursive: true });

/**
 * Secrets that must survive restarts but never reach the browser: a UI-saved API key and the
 * session signing secret. Stored in DATA_DIR/secrets.json with owner-only permissions.
 */
interface Secrets {
  apiKey?: string;
  workspaceId?: string;
  sessionSecret?: string;
}

const secretsFile = path.join(config.dataDir, "secrets.json");

function readSecrets(): Secrets {
  try {
    return JSON.parse(fs.readFileSync(secretsFile, "utf8")) as Secrets;
  } catch {
    return {};
  }
}

function writeSecrets(s: Secrets): void {
  fs.writeFileSync(secretsFile, JSON.stringify(s, null, 2), { mode: 0o600 });
  fs.chmodSync(secretsFile, 0o600);
}

export function getSessionSecret(): string {
  if (env.SESSION_SECRET?.trim()) return env.SESSION_SECRET.trim();
  const s = readSecrets();
  if (!s.sessionSecret) {
    s.sessionSecret = crypto.randomBytes(32).toString("hex");
    writeSecrets(s);
  }
  return s.sessionSecret;
}

export function getApiKey(): { key: string | null; source: "environment" | "settings" | "none" } {
  if (config.envApiKey) return { key: config.envApiKey, source: "environment" };
  const saved = readSecrets().apiKey;
  return saved ? { key: saved, source: "settings" } : { key: null, source: "none" };
}

export function saveApiKey(key: string | null): void {
  const s = readSecrets();
  if (key) s.apiKey = key;
  else delete s.apiKey;
  writeSecrets(s);
}

/** Workspace ID for API keys that are not scoped to a workspace (sent as the anthropic-workspace-id header). */
export function getWorkspaceId(): { id: string | null; source: "environment" | "settings" | "none" } {
  if (config.envWorkspaceId) return { id: config.envWorkspaceId, source: "environment" };
  const saved = readSecrets().workspaceId;
  return saved ? { id: saved, source: "settings" } : { id: null, source: "none" };
}

export function saveWorkspaceId(id: string | null): void {
  const s = readSecrets();
  if (id) s.workspaceId = id;
  else delete s.workspaceId;
  writeSecrets(s);
}

export function maskKey(key: string): string {
  return key.length <= 12 ? "••••" : `${key.slice(0, 7)}…${key.slice(-4)}`;
}
