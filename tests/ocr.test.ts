import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument, parseResume } from "../server/services/resumeParser";

// Fixtures are resume text rendered as images (no text layer) — see tests/fixtures/makeScan.ts.
describe("OCR for scanned resumes", () => {
  it("reads a scanned (image-only) PDF", async () => {
    const r = await parseResume("scan.pdf", fs.readFileSync("tests/fixtures/scanned.pdf"));
    expect(r.method).toBe("ocr");
    expect(r.text).toMatch(/Certified Public Accountant/);
    expect(r.email).toBe("maria.gonzalez@example.com");
    expect(r.name).toBe("Maria Gonzalez");
    expect(r.warnings[0]).toMatch(/read with OCR/);
  }, 60_000);

  it("reads a photo/PNG resume", async () => {
    const r = await parseResume("scan.png", fs.readFileSync("tests/fixtures/scanned.png"));
    expect(r.type).toBe("image");
    expect(r.text).toMatch(/Arizona State University/);
  }, 60_000);

  it("keeps normal text PDFs on the fast text path", async () => {
    const { jsPDF } = await import("jspdf");
    const d = new jsPDF();
    d.text("Plain text layer resume for Sam Example with enough words to count as readable text.", 10, 10);
    const r = await parseDocument("t.pdf", Buffer.from(d.output("arraybuffer")));
    expect(r.method).toBe("text");
  });

  it("rejects files that only pretend to be images", async () => {
    await expect(parseResume("fake.png", Buffer.from("hello"))).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
  });
});
