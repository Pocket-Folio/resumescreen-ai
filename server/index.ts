import path from "node:path";
import { config, isProduction } from "./config";
import { Store, now } from "./db";
import { createApp } from "./app";
import { log } from "./logger";

if (isProduction && !config.appPassword && !config.allowUnauthenticated) {
  log.error(
    "APP_PASSWORD is not set. Refusing to start in production without access control. " +
      "Set APP_PASSWORD (recommended) or ALLOW_UNAUTHENTICATED=true for an isolated machine.",
  );
  process.exit(1);
}

const store = new Store();

// A screening interrupted by a restart must not stay "in progress" forever.
for (const c of store.listCandidates()) {
  if (c.screeningStatus === "screening") {
    store.saveCandidate({ ...c, screeningStatus: c.latestScreeningId ? "screened" : "not_screened", updatedAt: now() });
  }
}

const staticDir = path.resolve(process.env.STATIC_DIR ?? "dist/client");
const app = createApp(store, staticDir);

const server = app.listen(config.port, () => {
  log.info("ResumeScreen AI listening", {
    port: config.port,
    dataDir: config.dataDir,
    auth: config.appPassword ? "password" : "disabled",
    mode: isProduction ? "production" : "development",
  });
  if (!config.appPassword) log.warn("Access control is disabled (APP_PASSWORD not set).");
});
// Screenings can legitimately take several minutes.
server.requestTimeout = 10 * 60 * 1000;
server.headersTimeout = 65 * 1000;

function shutdown(signal: string) {
  log.info("shutting down", { signal });
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
