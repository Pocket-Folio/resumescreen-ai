/**
 * Local persistence (SQLite via Node's built-in node:sqlite — no native add-ons to compile).
 *
 * Each entity is stored as a JSON document plus a few indexed columns. This keeps the schema
 * simple to evolve while still giving us transactions, a single portable file and fast lookups.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config";
import { AppError } from "./errors";
import type {
  AppSettings,
  AuditEvent,
  Candidate,
  JobProfile,
  ScreeningRecord,
} from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";

export const DB_FILE = path.join(config.dataDir, "resumescreen.db");

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const now = () => new Date().toISOString();

type Row = { data: string };

export class Store {
  private db: DatabaseSync;

  constructor(file: string = DB_FILE) {
    try {
      this.db = new DatabaseSync(file);
      this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
      this.migrate();
    } catch (e) {
      throw new AppError("DATABASE", "The local database could not be opened.", (e as Error).message);
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_profiles (
        id TEXT PRIMARY KEY, data TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY, job_profile_id TEXT, data TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS screenings (
        id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        job_profile_id TEXT, data TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_screenings_candidate ON screenings(candidate_id, created_at);
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY, at TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
        entity_id TEXT, detail TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  private parse<T>(rows: unknown[]): T[] {
    return (rows as Row[]).map((r) => JSON.parse(r.data) as T);
  }

  // ─── Job profiles ──────────────────────────────────────────
  listJobProfiles(): JobProfile[] {
    return this.parse<JobProfile>(this.db.prepare("SELECT data FROM job_profiles ORDER BY updated_at DESC").all());
  }

  getJobProfile(id: string): JobProfile | null {
    const row = this.db.prepare("SELECT data FROM job_profiles WHERE id = ?").get(id) as Row | undefined;
    return row ? (JSON.parse(row.data) as JobProfile) : null;
  }

  saveJobProfile(p: JobProfile): JobProfile {
    this.db
      .prepare(
        `INSERT INTO job_profiles (id, data, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(p.id, JSON.stringify(p), p.isDemo ? 1 : 0, p.createdAt, p.updatedAt);
    return p;
  }

  deleteJobProfile(id: string): void {
    this.tx(() => {
      this.db.prepare("DELETE FROM job_profiles WHERE id = ?").run(id);
      // Candidates keep their data but are detached from the deleted profile.
      for (const c of this.listCandidates().filter((c) => c.jobProfileId === id)) {
        this.saveCandidate({ ...c, jobProfileId: null, updatedAt: now() });
      }
    });
  }

  // ─── Candidates ────────────────────────────────────────────
  listCandidates(): Candidate[] {
    return this.parse<Candidate>(this.db.prepare("SELECT data FROM candidates ORDER BY created_at DESC").all());
  }

  getCandidate(id: string): Candidate | null {
    const row = this.db.prepare("SELECT data FROM candidates WHERE id = ?").get(id) as Row | undefined;
    return row ? (JSON.parse(row.data) as Candidate) : null;
  }

  saveCandidate(c: Candidate): Candidate {
    this.db
      .prepare(
        `INSERT INTO candidates (id, job_profile_id, data, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET job_profile_id = excluded.job_profile_id, data = excluded.data,
         updated_at = excluded.updated_at`,
      )
      .run(c.id, c.jobProfileId, JSON.stringify(c), c.isDemo ? 1 : 0, c.createdAt, c.updatedAt);
    return c;
  }

  /** Deletes the candidate, their resume text, HR notes and all screening history. */
  deleteCandidate(id: string): void {
    this.tx(() => {
      this.db.prepare("DELETE FROM screenings WHERE candidate_id = ?").run(id);
      this.db.prepare("DELETE FROM candidates WHERE id = ?").run(id);
    });
  }

  // ─── Screenings (append-only history) ──────────────────────
  listScreenings(candidateId?: string): ScreeningRecord[] {
    const rows = candidateId
      ? this.db.prepare("SELECT data FROM screenings WHERE candidate_id = ? ORDER BY created_at DESC").all(candidateId)
      : this.db.prepare("SELECT data FROM screenings ORDER BY created_at DESC").all();
    return this.parse<ScreeningRecord>(rows);
  }

  getScreening(id: string): ScreeningRecord | null {
    const row = this.db.prepare("SELECT data FROM screenings WHERE id = ?").get(id) as Row | undefined;
    return row ? (JSON.parse(row.data) as ScreeningRecord) : null;
  }

  insertScreening(s: ScreeningRecord): ScreeningRecord {
    this.db
      .prepare("INSERT INTO screenings (id, candidate_id, job_profile_id, data, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(s.id, s.candidateId, s.jobProfileId, JSON.stringify(s), s.isDemo ? 1 : 0, s.createdAt);
    return s;
  }

  // ─── Audit log ─────────────────────────────────────────────
  audit(action: string, entityType: AuditEvent["entityType"], entityId: string | null, detail: string): void {
    this.db
      .prepare("INSERT INTO audit_log (id, at, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId("evt"), now(), action, entityType, entityId, detail);
  }

  listAudit(limit = 500): AuditEvent[] {
    const rows = this.db
      .prepare("SELECT id, at, action, entity_type, entity_id, detail FROM audit_log ORDER BY at DESC LIMIT ?")
      .all(limit) as { id: string; at: string; action: string; entity_type: string; entity_id: string | null; detail: string }[];
    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      action: r.action,
      entityType: r.entity_type as AuditEvent["entityType"],
      entityId: r.entity_id,
      detail: r.detail,
    }));
  }

  // ─── Settings ──────────────────────────────────────────────
  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as { value: string } | undefined;
    const stored = row ? (JSON.parse(row.value) as Partial<AppSettings>) : {};
    return { ...DEFAULT_SETTINGS, model: config.defaultModel, ...stored };
  }

  saveSettings(s: AppSettings): AppSettings {
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(s));
    return s;
  }

  // ─── Bulk operations ───────────────────────────────────────
  counts() {
    const n = (sql: string) => (this.db.prepare(sql).get() as { n: number }).n;
    return {
      jobProfiles: n("SELECT COUNT(*) AS n FROM job_profiles"),
      candidates: n("SELECT COUNT(*) AS n FROM candidates"),
      screenings: n("SELECT COUNT(*) AS n FROM screenings"),
      auditEvents: n("SELECT COUNT(*) AS n FROM audit_log"),
      demoRecords:
        n("SELECT COUNT(*) AS n FROM job_profiles WHERE is_demo = 1") +
        n("SELECT COUNT(*) AS n FROM candidates WHERE is_demo = 1"),
    };
  }

  deleteDemoData(): void {
    this.tx(() => {
      this.db.exec("DELETE FROM screenings WHERE is_demo = 1 OR candidate_id IN (SELECT id FROM candidates WHERE is_demo = 1)");
      this.db.exec("DELETE FROM candidates WHERE is_demo = 1");
      this.db.exec("DELETE FROM job_profiles WHERE is_demo = 1");
    });
  }

  deleteAllData(resetSettings: boolean): void {
    this.tx(() => {
      this.db.exec("DELETE FROM screenings; DELETE FROM candidates; DELETE FROM job_profiles; DELETE FROM audit_log;");
      if (resetSettings) this.db.exec("DELETE FROM settings");
    });
    this.db.exec("VACUUM");
  }

  sizeBytes(file: string = DB_FILE): number {
    let total = 0;
    for (const f of [file, `${file}-wal`, `${file}-shm`]) {
      try {
        total += fs.statSync(f).size;
      } catch {
        /* file may not exist */
      }
    }
    return total;
  }

  close(): void {
    this.db.close();
  }
}
