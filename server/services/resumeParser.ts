/**
 * Resume parser: turns an uploaded file into plain text and pulls out contact details.
 * Runs entirely on this server — files are processed in memory and are not written to disk.
 */
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "../errors";
import { ocrImage, ocrPdf } from "./ocr";
import type { ResumeFileInfo } from "../../shared/types";

export type SupportedType = Exclude<ResumeFileInfo["type"], "manual">;

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
}

export interface ParsedDocument {
  text: string;
  type: SupportedType;
  method: "text" | "ocr";
  warnings: string[];
}

export interface ParsedResume extends ParsedDocument, ContactInfo {}

const MIN_TEXT_LENGTH = 80;

export function detectType(fileName: string, buf: Buffer): SupportedType {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const isPdf = buf.subarray(0, 5).toString("latin1") === "%PDF-";
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (ext === "pdf") {
    if (!isPdf) throw new AppError("UNSUPPORTED_FILE", `"${fileName}" has a .pdf extension but is not a valid PDF file.`);
    return "pdf";
  }
  if (ext === "docx") {
    if (!isZip) throw new AppError("UNSUPPORTED_FILE", `"${fileName}" has a .docx extension but is not a valid Word document.`);
    return "docx";
  }
  if (ext === "txt") return "txt";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") {
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!isPng && !isJpg) throw new AppError("UNSUPPORTED_FILE", `"${fileName}" is not a valid image file.`);
    return "image";
  }
  if (ext === "doc")
    throw new AppError(
      "UNSUPPORTED_FILE",
      `"${fileName}" is an older Word (.doc) file, which is not supported. Please save it as .docx or PDF and upload again.`,
    );
  throw new AppError("UNSUPPORTED_FILE", `"${fileName}" is not a supported file type. Upload a PDF, DOCX, TXT, JPG or PNG resume.`);
}

async function extractPdf(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).join("\n\n");
}

async function extractDocx(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

function decodeText(buf: Buffer): string {
  // Strip a UTF-8 BOM; fall back to latin1 when the file is not valid UTF-8.
  const utf8 = buf.toString("utf8").replace(/^\uFEFF/, "");
  return utf8.includes("\uFFFD") ? buf.toString("latin1") : utf8;
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Minimum characters for a PDF text layer to count as readable; below this we OCR. */
const MIN_TEXT_LAYER = 50;

/** Extracts plain text from a PDF, DOCX, TXT or image file (OCR for scans and images). */
export async function parseDocument(fileName: string, buf: Buffer): Promise<ParsedDocument> {
  if (buf.length === 0) throw new AppError("EMPTY_RESUME", `"${fileName}" is empty.`);
  const type = detectType(fileName, buf);
  const warnings: string[] = [];
  let method: ParsedDocument["method"] = "text";
  let raw: string;
  try {
    if (type === "pdf") {
      raw = await extractPdf(buf);
      if (normalizeText(raw).replace(/\s/g, "").length < MIN_TEXT_LAYER) {
        // Scanned PDF: no usable text layer, so read the page images.
        const ocr = await ocrPdf(buf);
        raw = ocr.text;
        method = "ocr";
        if (ocr.truncated) warnings.push(`Only the first ${ocr.pages} pages were read with OCR.`);
        if (ocr.confidence < 70) warnings.push("The scan is hard to read, so some words may be wrong. Check the text, or use “Read with Claude”.");
      }
    } else if (type === "image") {
      const ocr = await ocrImage(buf);
      raw = ocr.text;
      method = "ocr";
      if (ocr.confidence < 70) warnings.push("The image is hard to read, so some words may be wrong. Check the text, or use “Read with Claude”.");
    } else {
      raw = type === "docx" ? await extractDocx(buf) : decodeText(buf);
    }
  } catch (e) {
    throw new AppError(
      "EXTRACTION_FAILED",
      `Text could not be read from "${fileName}". The file may be damaged or password-protected. You can retry, use “Read with Claude”, or paste the text manually.`,
      (e as Error).message,
    );
  }
  const text = normalizeText(raw);
  if (text.replace(/\s/g, "").length === 0) {
    throw new AppError(
      "EXTRACTION_FAILED",
      `No readable text was found in "${fileName}", even with OCR. Try “Read with Claude”, upload a clearer copy, or paste the text manually.`,
    );
  }
  if (method === "ocr") warnings.unshift("This file is a scanned image, so its text was read with OCR. Please check it for recognition errors before screening.");
  if (text.length < MIN_TEXT_LENGTH) warnings.push("Very little text was extracted. Please check the extracted text before screening.");
  return { text, type, method, warnings };
}

export async function parseResume(fileName: string, buf: Buffer): Promise<ParsedResume> {
  const doc = await parseDocument(fileName, buf);
  return { ...doc, ...extractContactInfo(doc.text) };
}

// ─── Contact information ─────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Phone numbers such as "(512) 555-0142", "555-014-7788" or "+44 20 7946 0958". */
export const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]+|github\.com\/[\w-]+|[\w-]+\.(?:dev|io|me|com|net|org)\/[\w\-/.]*|https?:\/\/[^\s)]+)/gi;
const NOT_NAME = /\b(resume|curriculum|vitae|cv|profile|summary|objective|experience|contact|page)\b/i;

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
}

function guessName(lines: string[]): string {
  for (const raw of lines.slice(0, 6)) {
    const candidate = raw.split(/\s[|•·–—]\s|\t/)[0].replace(/^name\s*:\s*/i, "").trim();
    if (!candidate || candidate.length > 50 || /[\d@/:]/.test(candidate) || NOT_NAME.test(candidate)) continue;
    const words = candidate.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[\p{Lu}][\p{L}'.-]*$/u.test(w))) continue;
    return candidate === candidate.toUpperCase() ? titleCase(candidate) : candidate;
  }
  return "";
}

function guessLocation(lines: string[]): string {
  const labelled = lines.find((l) => /^(location|address|based in)\s*:/i.test(l));
  if (labelled) return labelled.replace(/^[^:]+:\s*/, "").slice(0, 80);
  for (const line of lines.slice(0, 8)) {
    for (const part of line.split(/\s*[|•·]\s*|\s{2,}/)) {
      if (EMAIL_RE.test(part) || /\d{3}/.test(part)) {
        EMAIL_RE.lastIndex = 0;
        continue;
      }
      EMAIL_RE.lastIndex = 0;
      const m = part.match(/^([\p{Lu}][\p{L}.' -]+,\s*(?:[A-Z]{2}|[\p{Lu}][\p{L} ]+))$/u);
      if (m && m[1].length <= 60) return m[1].trim();
    }
  }
  return "";
}

export function extractContactInfo(text: string): ContactInfo {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  const phone =
    (text.match(PHONE_RE) ?? [])
      .map((p) => p.trim())
      .find((p) => {
        const digits = p.replace(/\D/g, "").length;
        return digits >= 10 && digits <= 15 && !/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(p);
      }) ?? "";
  const links = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;]$/, "")))]
    .filter((u) => !u.includes("@"))
    .slice(0, 5);
  return { name: guessName(lines), email, phone, location: guessLocation(lines), links };
}
