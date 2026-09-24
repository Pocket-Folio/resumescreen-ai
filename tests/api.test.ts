import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Store } from "../server/db";
import { createApp } from "../server/app";
import { demoJobProfiles } from "../server/demo/demoData";
import type { Candidate, CandidateListItem, JobProfile } from "../shared/types";

async function start(app: ReturnType<typeof createApp>) {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, base };
}

describe("API and local persistence", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rs-api-")), "test.db");
  let store: Store;
  let base: string;
  let close: () => void;

  beforeAll(async () => {
    store = new Store(file);
    const s = await start(createApp(store));
    base = s.base;
    close = () => s.server.close();
  });
  afterAll(() => {
    close();
    store.close();
  });

  const json = async <T>(method: string, url: string, body?: unknown) => {
    const res = await fetch(base + url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as T };
  };

  it("creates, updates and deletes job profiles", async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, isDemo: _d, ...input } = demoJobProfiles[0];
    const created = await json<JobProfile>("POST", "/api/job-profiles", { ...input, title: "QA Engineer" });
    expect(created.status).toBe(201);
    const updated = await json<JobProfile>("PUT", `/api/job-profiles/${created.body.id}`, { ...input, title: "QA Lead" });
    expect(updated.body.title).toBe("QA Lead");
    const invalid = await json<{ error: { code: string } }>("POST", "/api/job-profiles", { ...input, title: "" });
    expect(invalid.status).toBe(400);
    expect((await json("DELETE", `/api/job-profiles/${created.body.id}`)).status).toBe(200);
    expect((await json("GET", `/api/job-profiles/${created.body.id}`)).status).toBe(404);
  });

  it("uploads a resume, persists it, and deletes it with its history", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["Sam Tester\nsam@example.com\nQA engineer since 2019 writing automated tests in Python and Playwright."]), "sam.txt");
    const res = await fetch(`${base}/api/candidates/upload`, { method: "POST", body: fd });
    const c = (await res.json()) as Candidate;
    expect(res.status).toBe(201);
    expect(c.name).toBe("Sam Tester");
    expect(c.extraction.status).toBe("success");

    // Survives a fresh Store instance (i.e. a restart).
    const reopened = new Store(file);
    expect(reopened.getCandidate(c.id)?.resumeText).toContain("Playwright");
    reopened.close();

    const review = await json<Candidate>("PUT", `/api/candidates/${c.id}/review`, { reviewer: "HR", status: "in_progress", notes: "n", followUpQuestions: "", verificationRequired: "", decision: "request_more_info" });
    expect(review.body.hrReview?.decision).toBe("request_more_info");

    expect((await json("DELETE", `/api/candidates/${c.id}`)).status).toBe(200);
    expect(store.getCandidate(c.id)).toBeNull();
    expect(store.listScreenings(c.id)).toHaveLength(0);
  });

  it("rejects unsupported uploads and keeps failed extractions for retry", async () => {
    const bad = new FormData();
    bad.append("file", new Blob(["x"]), "photo.png");
    const r1 = await fetch(`${base}/api/candidates/upload`, { method: "POST", body: bad });
    expect(r1.status).toBe(415);

    const blank = new FormData();
    blank.append("file", new Blob(["   "]), "blank.txt");
    const r2 = await fetch(`${base}/api/candidates/upload`, { method: "POST", body: blank });
    const c = (await r2.json()) as Candidate;
    expect(c.extraction.status).toBe("failed");
    const fixed = await json<Candidate>("PUT", `/api/candidates/${c.id}`, { resumeText: "Pasted resume text for this candidate." });
    expect(fixed.body.extraction.status).toBe("manual");
  });

  it("pasting resume text keeps the candidate's name and contact details", async () => {
    const blank = new FormData();
    blank.append("file", new Blob(["  "]), "Jane_Roe_Resume.txt");
    const c = (await (await fetch(`${base}/api/candidates/upload`, { method: "POST", body: blank })).json()) as Candidate;
    await json("PUT", `/api/candidates/${c.id}`, { name: "Jane Roe", email: "jane@example.com" });
    const after = await json<Candidate>("PUT", `/api/candidates/${c.id}`, { resumeText: "Jane Roe, accountant with 5 years of experience." });
    expect(after.body.name).toBe("Jane Roe");
    expect(after.body.email).toBe("jane@example.com");
    expect(after.body.resumeText).toContain("accountant");
  });

  it("uploads a scanned PDF and extracts it with OCR", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync("tests/fixtures/scanned.pdf")]), "maria scan.pdf");
    const c = (await (await fetch(`${base}/api/candidates/upload`, { method: "POST", body: fd })).json()) as Candidate;
    expect(c.extraction.status).toBe("success");
    expect(c.extraction.method).toBe("ocr");
    expect(c.name).toBe("Maria Gonzalez");
  }, 60_000);

  it("imports a job description file", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["Senior Accountant\nWe need a CPA with 5+ years of experience in month-end close."]), "jd.txt");
    const r = (await (await fetch(`${base}/api/job-profiles/extract-description`, { method: "POST", body: fd })).json()) as { text: string };
    expect(r.text).toContain("CPA with 5+ years");
  });

  it("drafting criteria without an API key gives a clear error", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await json<{ error: { code: string } }>("POST", "/api/job-profiles/draft", { title: "Accountant", description: "We need a CPA with 5+ years of experience in month-end close and reporting." });
    expect(r.body.error.code).toBe("NOT_CONFIGURED");
  });

  it("loads demo data with valid screening summaries", async () => {
    await json("POST", "/api/demo");
    const list = await json<CandidateListItem[]>("GET", "/api/candidates");
    const demo = list.body.filter((c) => c.isDemo);
    expect(demo).toHaveLength(5);
    expect(demo.filter((c) => c.latest)).toHaveLength(4);
    // Reloading does not duplicate.
    await json("POST", "/api/demo");
    expect((await json<CandidateListItem[]>("GET", "/api/candidates")).body.filter((c) => c.isDemo)).toHaveLength(5);
  });

  it("returns a clear error when screening without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await fetch(`${base}/api/screenings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: "demo_cand_elena", jobProfileId: "demo_job_backend" }) });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: "error", error: { code: "NOT_CONFIGURED" } });
    // Candidate status is restored, not left "screening".
    expect(store.getCandidate("demo_cand_elena")?.screeningStatus).toBe("not_screened");
  });

  it("never returns the API key to the browser", async () => {
    const body = await json<{ apiKey: { masked: string | null } }>("PUT", "/api/settings/api-key", { apiKey: "sk-ant-test-" + "a".repeat(40) });
    expect(body.body.apiKey.masked).toBe("sk-ant-…aaaa");
    const settings = await fetch(`${base}/api/settings`).then((r) => r.text());
    expect(settings).not.toContain("a".repeat(20));
    await json("DELETE", "/api/settings/api-key");
  });

  it("deletes all local data", async () => {
    const r = await json("POST", "/api/data/delete-all", { confirm: "DELETE", resetSettings: true });
    expect(r.status).toBe(200);
    expect(store.counts()).toMatchObject({ jobProfiles: 0, candidates: 0, screenings: 0 });
    expect((await json("POST", "/api/data/delete-all", {})).status).toBe(400);
  });
});

describe("access control", () => {
  it("requires the app password when configured", async () => {
    vi.resetModules();
    process.env.APP_PASSWORD = "correct horse";
    const { createApp: create } = await import("../server/app");
    const { Store: S } = await import("../server/db");
    const store = new S(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rs-auth-")), "a.db"));
    const { server, base } = await start(create(store));
    try {
      expect((await fetch(`${base}/api/candidates`)).status).toBe(401);
      const wrong = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "nope" }) });
      expect(wrong.status).toBe(401);
      const ok = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "correct horse" }) });
      const cookie = ok.headers.get("set-cookie")!.split(";")[0];
      expect(cookie).toMatch(/^rs_session=/);
      expect((await fetch(`${base}/api/candidates`, { headers: { cookie } })).status).toBe(200);
      expect((await fetch(`${base}/api/candidates`, { headers: { cookie: "rs_session=9999999999999.forged" } })).status).toBe(401);
    } finally {
      server.close();
      store.close();
      delete process.env.APP_PASSWORD;
    }
  });
});
