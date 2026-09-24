/**
 * Optional, HR-initiated text extraction with Claude for scans that local OCR cannot read well.
 * The file is sent to the Claude API only when HR explicitly clicks "Read with Claude".
 */
import { AppError } from "../../errors";
import { getClient, modelOptions, toAppError } from "./claudeClient";
import { normalizeText, type SupportedType } from "../resumeParser";

const INSTRUCTIONS = `Transcribe all text in this document as plain text, in reading order. Keep section headings, dates, job titles and bullet points on their own lines. Do not summarise, correct, translate, add or omit anything. Do not describe photos or graphics. Output only the transcribed text.`;

export async function extractWithClaude(buf: Buffer, type: SupportedType, fileName: string, model: string): Promise<string> {
  if (type !== "pdf" && type !== "image") {
    throw new AppError("VALIDATION", "Reading with Claude is only needed for PDFs and images. This file's text can be extracted locally.");
  }
  const data = buf.toString("base64");
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const source =
    type === "pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: isPng ? "image/png" : "image/jpeg", data } } as const);
  const { thinking } = modelOptions(model, "low");
  try {
    const msg = await getClient().messages.create({
      model,
      max_tokens: 16000,
      ...(thinking ? { thinking, output_config: { effort: "low" as const } } : {}),
      messages: [{ role: "user", content: [source, { type: "text", text: INSTRUCTIONS }] }],
    });
    if (msg.stop_reason === "refusal") throw new AppError("REFUSED", `Claude could not read "${fileName}". Please paste the text manually.`);
    const text = normalizeText(msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n"));
    if (!text) throw new AppError("EXTRACTION_FAILED", `Claude found no readable text in "${fileName}". Please paste the text manually.`);
    return text;
  } catch (e) {
    throw toAppError(e);
  }
}
