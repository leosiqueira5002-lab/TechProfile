import { extractRawText } from "mammoth";
import { PasswordException, PDFParse } from "pdf-parse";
import { ResumeProcessingError } from "./errors";
import {
  EXTRACTION_TIMEOUT_MS,
  MAX_EXTRACTED_CHARACTERS,
  MAX_PDF_PAGES,
  type ResumeFormat,
} from "./limits";

export type ExtractedResumeContent = {
  text: string;
  pageCount: number | null;
};

export async function extractResumeContent(buffer: Buffer, format: ResumeFormat): Promise<ExtractedResumeContent> {
  const extracted = format === "pdf"
    ? await extractPdfText(buffer)
    : { text: await extractDocxText(buffer), pageCount: null };
  return { text: normalizeResumeText(extracted.text), pageCount: extracted.pageCount };
}

export function normalizeResumeText(value: string): string {
  const normalized = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (normalized.length > MAX_EXTRACTED_CHARACTERS) {
    throw new ResumeProcessingError("TEXT_TOO_LARGE");
  }
  if (!normalized) throw new ResumeProcessingError("EMPTY_TEXT");
  return normalized;
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await withTimeout(parser.getInfo(), EXTRACTION_TIMEOUT_MS);
    if (info.total > MAX_PDF_PAGES) throw new ResumeProcessingError("TOO_MANY_PAGES");

    const result = await withTimeout(parser.getText({ last: MAX_PDF_PAGES }), EXTRACTION_TIMEOUT_MS);
    return { text: result.pages.map((page) => page.text).join("\n"), pageCount: info.total };
  } catch (error) {
    if (error instanceof ResumeProcessingError) throw error;
    if (error instanceof PasswordException || (error instanceof Error && error.name === "PasswordException")) {
      throw new ResumeProcessingError("ENCRYPTED_FILE");
    }
    if (error instanceof Error && error.message === "RESUME_PROCESSING_TIMEOUT") {
      throw new ResumeProcessingError("PROCESSING_TIMEOUT");
    }
    throw new ResumeProcessingError("INVALID_FILE");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await withTimeout(extractRawText({ buffer }), EXTRACTION_TIMEOUT_MS);
    return result.value;
  } catch (error) {
    if (error instanceof ResumeProcessingError) throw error;
    if (error instanceof Error && error.message === "RESUME_PROCESSING_TIMEOUT") {
      throw new ResumeProcessingError("PROCESSING_TIMEOUT");
    }
    throw new ResumeProcessingError("INVALID_FILE");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("RESUME_PROCESSING_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error: unknown) => { clearTimeout(timeout); reject(error); },
    );
  });
}
