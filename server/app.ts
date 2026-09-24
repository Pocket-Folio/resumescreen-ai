import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import type { Store } from "./db";
import { config } from "./config";
import { AppError } from "./errors";
import { log } from "./logger";
import { authEnabled, isAuthenticated, login, logout, requireAuth } from "./auth";
import { jobProfileRoutes } from "./routes/jobProfiles";
import { candidateRoutes } from "./routes/candidates";
import { screeningRoutes } from "./routes/screenings";
import { settingsRoutes } from "./routes/settings";
import { systemRoutes } from "./routes/system";

export function createApp(store: Store, staticDir?: string) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback, uniquelocal");

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:", "blob:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'"],
          // Only force HTTPS upgrades when the deployment is actually served over HTTPS.
          "upgrade-insecure-requests": config.cookieSecure ? [] : null,
        },
      },
      strictTransportSecurity: config.cookieSecure,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  // ─── Public endpoints ──────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/auth/status", (req, res) => {
    res.json({ authEnabled: authEnabled(), authenticated: isAuthenticated(req) });
  });
  app.post("/api/auth/login", login);
  app.post("/api/auth/logout", logout);

  // ─── Protected API ─────────────────────────────────────────
  app.use("/api", requireAuth);
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/job-profiles", jobProfileRoutes(store));
  app.use("/api/candidates", candidateRoutes(store));
  app.use("/api/screenings", screeningRoutes(store));
  app.use("/api/settings", settingsRoutes(store));
  app.use("/api", systemRoutes(store));
  app.use("/api", (_req, _res, next) => next(new AppError("NOT_FOUND", "Unknown API endpoint.")));

  // ─── Static UI (production build) ──────────────────────────
  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // ─── Errors ────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let e: AppError;
    if (err instanceof AppError) e = err;
    else if ((err as { type?: string })?.type === "entity.too.large") e = new AppError("VALIDATION", "The request is too large.");
    else if ((err as { type?: string })?.type === "entity.parse.failed") e = new AppError("VALIDATION", "The request body is not valid JSON.");
    else {
      log.error("unhandled error", { message: (err as Error)?.message ?? String(err) });
      e = new AppError("INTERNAL", "Something went wrong on the server. Please try again.");
    }
    if (res.headersSent) return res.end();
    res.status(e.status).json({ error: e.toBody() });
  });

  return app;
}
