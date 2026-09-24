import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { extractContactInfo, parseResume } from "../server/services/resumeParser";
import { redactResume } from "../server/services/redaction";

const TXT = `JANE Q DOE
Austin, TX | jane.doe@example.com | (512) 555-0142 | linkedin.com/in/janedoe
Software engineer 2018 – 2024 building Python services and REST APIs for fintech customers.`;

describe("resume parsing", () => {
  it("extracts text and contact details from TXT", async () => {
    const r = await parseResume("resume.txt", Buffer.from(TXT));
    expect(r.type).toBe("txt");
    expect(r.name).toBe("Jane Q Doe");
    expect(r.email).toBe("jane.doe@example.com");
    expect(r.phone).toBe("(512) 555-0142");
    expect(r.location).toBe("Austin, TX");
    expect(r.links).toContain("linkedin.com/in/janedoe");
  });

  it("extracts text from DOCX", async () => {
    const r = await parseResume("sample.docx", fs.readFileSync("tests/fixtures/sample.docx"));
    expect(r.type).toBe("docx");
    expect(r.text).toContain("Python ETL pipelines");
    expect(r.name).toBe("Jordan Example");
    expect(r.email).toBe("jordan@example.com");
  });

  it("extracts text from PDF", async () => {
    const doc = new jsPDF();
    doc.text("Alex Sample", 10, 10);
    doc.text("alex@example.com | Denver, CO", 10, 20);
    doc.text("Senior Accountant with 6 years of audit experience and CPA certification.", 10, 30);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const r = await parseResume("alex.pdf", buf);
    expect(r.type).toBe("pdf");
    expect(r.text).toContain("CPA certification");
    expect(r.email).toBe("alex@example.com");
  });

  it("rejects unsupported and invalid files with clear errors", async () => {
    await expect(parseResume("photo.png", Buffer.from("x"))).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
    await expect(parseResume("old.doc", Buffer.from("x"))).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
    await expect(parseResume("fake.pdf", Buffer.from("not a pdf"))).rejects.toMatchObject({ code: "UNSUPPORTED_FILE" });
    await expect(parseResume("empty.txt", Buffer.alloc(0))).rejects.toMatchObject({ code: "EMPTY_RESUME" });
    await expect(parseResume("blank.txt", Buffer.from("   \n  "))).rejects.toMatchObject({ code: "EXTRACTION_FAILED" });
  });

  it("does not mistake date ranges for phone numbers", () => {
    expect(extractContactInfo("Worked 2019 - 2021 at Acme").phone).toBe("");
  });
});

describe("redaction", () => {
  it("removes contact details and the candidate's name", () => {
    const out = redactResume(TXT, { contactInfo: true, name: true, candidateName: "Jane Q Doe" });
    expect(out).not.toMatch(/jane\.doe@example\.com|555-0142|linkedin|Jane|Doe/i);
    expect(out).toContain("[EMAIL REDACTED]");
    expect(out).toContain("[PHONE REDACTED]");
    expect(out).toContain("2018 – 2024");
  });

  it("leaves text unchanged when redaction is off", () => {
    expect(redactResume(TXT, { contactInfo: false, name: false })).toBe(TXT);
  });
});
