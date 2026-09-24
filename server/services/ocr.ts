/**
 * Local OCR for scanned resumes (image-only PDFs, JPG/PNG photos of resumes).
 * Runs entirely on this server with Tesseract (WebAssembly) and the bundled English model —
 * nothing is sent to any external service.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { createWorker, OEM, type Worker } from "tesseract.js";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { log } from "../logger";

const require = createRequire(import.meta.url);
const MAX_OCR_PAGES = 6;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const langPath = path.join(path.dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
    workerPromise = createWorker("eng", OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: "none" }).catch((e: unknown) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export interface OcrResult {
  text: string;
  /** Mean word confidence, 0–100. */
  confidence: number;
  pages: number;
  truncated: boolean;
}

export async function ocrImage(image: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return { text: data.text, confidence: data.confidence };
}

export async function ocrPdf(pdf: Buffer): Promise<OcrResult> {
  // pdf.js may detach the buffers it is given, so hand it fresh copies.
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const total = doc.numPages;
  const pages = Math.min(total, MAX_OCR_PAGES);
  const texts: string[] = [];
  let confSum = 0;
  const started = Date.now();
  for (let i = 1; i <= pages; i++) {
    const png = await renderPageAsImage(new Uint8Array(pdf), i, { canvasImport: () => import("@napi-rs/canvas"), scale: 2.5 });
    const r = await ocrImage(Buffer.from(png));
    texts.push(r.text);
    confSum += r.confidence;
  }
  log.info("ocr completed", { pages, ms: Date.now() - started });
  return { text: texts.join("\n\n"), confidence: pages ? confSum / pages : 0, pages, truncated: total > pages };
}
