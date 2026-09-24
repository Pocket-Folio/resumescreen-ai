/**
 * Removes direct identifiers from resume text before it is sent to Claude.
 * Contact details are not needed to assess job-related criteria, and removing the name
 * reduces the chance of name-based bias.
 */
import { PHONE_RE } from "./resumeParser";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s)]+|\b(?:linkedin|github)\.com\/[^\s)]+/gi;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface RedactionOptions {
  contactInfo: boolean;
  name: boolean;
  candidateName?: string;
}

export function redactResume(text: string, opts: RedactionOptions): string {
  let out = text;
  if (opts.contactInfo) {
    out = out
      .replace(EMAIL_RE, "[EMAIL REDACTED]")
      .replace(URL_RE, "[LINK REDACTED]")
      .replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[PHONE REDACTED]" : m));
  }
  if (opts.name && opts.candidateName?.trim()) {
    const full = opts.candidateName.trim();
    out = out.replace(new RegExp(escapeRe(full), "gi"), "[CANDIDATE]");
    for (const part of full.split(/\s+/).filter((p) => p.length > 2)) {
      out = out.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "g"), "[CANDIDATE]");
    }
  }
  return out;
}
