import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getResumeErrorMessage, ResumeProcessingError, type ResumeErrorCode } from "@/features/documents/errors";
import { extractResumeContent } from "@/features/documents/extract";
import { MAX_FILE_BYTES, MAX_REQUEST_BYTES, MIME_TYPES } from "@/features/documents/limits";
import { getSafeResumeName, validateResumeContent, validateResumeMetadata } from "@/features/documents/validation";
import { storeResumePrivately } from "@/lib/storage/supabase-storage";
import type { ProcessedResumeDocument } from "@/features/documents/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      throw new ResumeProcessingError("REQUEST_TOO_LARGE");
    }

    const formData = await readBoundedFormData(request);
    const files = formData.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File)) {
      throw new ResumeProcessingError("MISSING_FILE");
    }

    const file = files[0];
    const originalName = getSafeResumeName(file.name);
    const format = validateResumeMetadata({ name: originalName, type: file.type, size: file.size });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength !== file.size || buffer.byteLength > MAX_FILE_BYTES) {
      throw new ResumeProcessingError("FILE_TOO_LARGE");
    }

    const uploadedAt = new Date().toISOString();
    await validateResumeContent(format, buffer);
    const { text, pageCount } = await extractResumeContent(buffer, format);
    const accessToken = getBearerToken(request.headers.get("authorization"));
    const stored = await storeResumePrivately({
      buffer,
      contentType: MIME_TYPES[format],
      extension: format,
      accessToken,
    });
    const document: ProcessedResumeDocument = {
      id: randomUUID(),
      originalName,
      format,
      mimeType: MIME_TYPES[format],
      sizeBytes: buffer.byteLength,
      pageCount,
      extractedText: text,
      status: "processed",
      uploadedAt,
      processedAt: new Date().toISOString(),
      storage: { persisted: stored, provider: stored ? "supabase" : "temporary" },
    };

    return NextResponse.json({ document }, { status: 200 });
  } catch (error) {
    const code = error instanceof ResumeProcessingError ? error.code : "INVALID_FILE";
    return NextResponse.json({ error: getResumeErrorMessage(code) }, { status: statusForError(code) });
  }
}

async function readBoundedFormData(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ResumeProcessingError("MISSING_FILE");
  }

  if (!request.body) throw new ResumeProcessingError("MISSING_FILE");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ResumeProcessingError("REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body,
  }).formData();
}

function getBearerToken(value: string | null): string | undefined {
  if (!value) return undefined;
  const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(value.trim());
  return match?.[1];
}

function statusForError(code: ResumeErrorCode): number {
  if (code === "FILE_TOO_LARGE" || code === "REQUEST_TOO_LARGE") return 413;
  if (code === "STORAGE_AUTH_REQUIRED") return 401;
  if (code === "STORAGE_NOT_CONFIGURED" || code === "STORAGE_FAILED") return 503;
  if (code === "INVALID_FILE" || code === "UNSAFE_ARCHIVE" || code === "EMPTY_TEXT" || code === "ENCRYPTED_FILE" || code === "TOO_MANY_PAGES" || code === "TEXT_TOO_LARGE" || code === "PROCESSING_TIMEOUT") return 422;
  return 400;
}
