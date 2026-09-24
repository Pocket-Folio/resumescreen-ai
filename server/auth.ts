/**
 * Optional shared-password access control (APP_PASSWORD). Sessions are stateless HMAC-signed
 * cookies. Intended for a small HR team behind HTTPS; for larger deployments put the app behind
 * your organisation's SSO proxy instead (see README).
 */
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config, getSessionSecret } from "./config";
import { AppError } from "./errors";

const COOKIE = "rs_session";
const SESSION_HOURS = 12;
const secret = () => getSessionSecret();

export const authEnabled = () => Boolean(config.appPassword);

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function isAuthenticated(req: Request): boolean {
  if (!authEnabled()) return true;
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || !safeEqual(sign(expires), sig)) return false;
  return Number(expires) > Date.now();
}

// Simple in-memory brute-force protection: 10 attempts per 15 minutes per IP.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function login(req: Request, res: Response): void {
  const ip = req.ip ?? "unknown";
  const entry = attempts.get(ip);
  const t = Date.now();
  if (entry && entry.resetAt > t && entry.count >= 10) {
    throw new AppError("RATE_LIMITED", "Too many sign-in attempts. Please wait 15 minutes and try again.");
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!config.appPassword || !safeEqual(password, config.appPassword)) {
    const e = entry && entry.resetAt > t ? entry : { count: 0, resetAt: t + 15 * 60_000 };
    e.count += 1;
    attempts.set(ip, e);
    throw new AppError("UNAUTHORIZED", "Incorrect password.");
  }
  attempts.delete(ip);
  const expires = String(t + SESSION_HOURS * 3600_000);
  res.cookie(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    maxAge: SESSION_HOURS * 3600_000,
    path: "/",
  });
  res.json({ ok: true });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) return next();
  next(new AppError("UNAUTHORIZED", "Your session has expired. Please sign in again."));
}
