import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { candidatePdf, toCSV } from "../src/utils/export";
import { Store } from "../server/db";
import { loadDemoData } from "../server/demo/demoData";
import { findSensitiveTerms } from "../shared/sensitiveTerms";

describe("exports", () => {
  it("guards CSV against formula injection and escapes quotes", () => {
    const csv = toCSV([["=HYPERLINK(1)", 'a "quote"', "plain"]]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"a ""quote"""');
  });

  it("builds a candidate PDF that labels AI and HR sections", async () => {
    const store = new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rs-exp-")), "e.db"));
    loadDemoData(store);
    const c = store.getCandidate("demo_cand_priya")!;
    const s = store.listScreenings(c.id)[0];
    const blob = await candidatePdf(c, s, { exportIncludeHrNotes: true, exportIncludeResumeText: false });
    const buf = new Uint8Array(await blob.arrayBuffer());
    if (process.env.EXPORT_SAMPLE_PDF) fs.writeFileSync(process.env.EXPORT_SAMPLE_PDF, buf);
    const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
    expect(text).toContain("AI-GENERATED");
    expect(text).toContain("HR-ENTERED");
    expect(text).toContain("Strong Alignment");
    store.close();
  });
});

describe("sensitive criteria detection", () => {
  it("flags protected characteristics but not job-related terms", () => {
    expect(findSensitiveTerms("Age under 35")).toContain("age");
    expect(findSensitiveTerms("Native English speaker")).toContain("national origin");
    expect(findSensitiveTerms("Married with children")).toContain("family or marital status / pregnancy");
    expect(findSensitiveTerms("Healthcare industry experience")).toEqual([]);
    expect(findSensitiveTerms("Page layout and design")).toEqual([]);
    expect(findSensitiveTerms("Python, 5+ years")).toEqual([]);
  });
});
