import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { ResumeProcessingError } from "./errors";
import {
  MAX_DOCX_ENTRIES,
  MAX_DOCX_EXPANDED_BYTES,
  MAX_DOCX_EXPANSION_RATIO,
  MAX_FILE_BYTES,
  MIME_TYPES,
  type ResumeFormat,
} from "./limits";

export type UploadedResume = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

export function getSafeResumeName(name: string): string {
  const basename = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
}

export function getResumeFormat(name: string): ResumeFormat {
  const safeName = getSafeResumeName(name);
  const extension = safeName.split(".").pop()?.toLowerCase();

  if (safeName && (extension === "pdf" || extension === "docx")) return extension;
  throw new ResumeProcessingError("UNSUPPORTED_TYPE");
}

export function validateResumeMetadata(file: Pick<UploadedResume, "name" | "type" | "size">): ResumeFormat {
  const format = getResumeFormat(file.name);
  if (file.size <= 0) throw new ResumeProcessingError("INVALID_FILE");
  if (file.size > MAX_FILE_BYTES) throw new ResumeProcessingError("FILE_TOO_LARGE");

  const declaredType = file.type.trim().toLowerCase();
  if (declaredType !== MIME_TYPES[format]) {
    throw new ResumeProcessingError("MIME_MISMATCH");
  }

  return format;
}

export async function validateResumeContent(format: ResumeFormat, buffer: Buffer): Promise<void> {
  if (format === "pdf") {
    const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
    if (!header.includes("%PDF-")) throw new ResumeProcessingError("INVALID_FILE");
    return;
  }

  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new ResumeProcessingError("INVALID_FILE");
  }

  await inspectDocxArchive(buffer);
}

function inspectDocxArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, autoClose: true, validateEntrySizes: true }, (openError, archive) => {
      if (openError || !archive) {
        reject(new ResumeProcessingError("UNSAFE_ARCHIVE"));
        return;
      }

      let entryCount = 0;
      let expandedBytes = 0;
      let actualExpandedBytes = 0;
      let settled = false;
      const requiredEntries = new Set(["[Content_Types].xml", "word/document.xml"]);

      const fail = () => {
        if (settled) return;
        settled = true;
        archive.close();
        reject(new ResumeProcessingError("UNSAFE_ARCHIVE"));
      };

      archive.on("error", fail);
      archive.on("end", () => {
        if (settled) return;
        if (requiredEntries.size > 0) {
          fail();
          return;
        }
        settled = true;
        resolve();
      });

      archive.on("entry", (entry: Entry) => {
        entryCount += 1;
        if (
          entryCount > MAX_DOCX_ENTRIES ||
          (entry.generalPurposeBitFlag & 0x1) !== 0 ||
          !Number.isSafeInteger(entry.uncompressedSize) ||
          entry.uncompressedSize > MAX_DOCX_EXPANDED_BYTES ||
          (entry.uncompressedSize > 0 && entry.compressedSize === 0) ||
          (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_DOCX_EXPANSION_RATIO)
        ) {
          fail();
          return;
        }

        expandedBytes += entry.uncompressedSize;
        if (expandedBytes > MAX_DOCX_EXPANDED_BYTES) {
          fail();
          return;
        }

        requiredEntries.delete(entry.fileName);
        consumeEntry(archive, entry, (entryBytes) => {
          if (settled) return;
          actualExpandedBytes += entryBytes;
          if (actualExpandedBytes > MAX_DOCX_EXPANDED_BYTES) {
            fail();
            return;
          }
          archive.readEntry();
        }, fail);
      });

      archive.readEntry();
    });
  });
}

function consumeEntry(
  archive: ZipFile,
  entry: Entry,
  onEnd: (entryBytes: number) => void,
  onError: () => void,
) {
  archive.openReadStream(entry, (streamError, stream) => {
    if (streamError || !stream) {
      onError();
      return;
    }

    let entryBytes = 0;
    stream.on("data", (chunk: Buffer) => {
      entryBytes += chunk.length;
      if (entryBytes > entry.uncompressedSize || entryBytes > MAX_DOCX_EXPANDED_BYTES) {
        stream.destroy(new Error("DOCX expanded data exceeds declared size"));
      }
    });
    stream.on("error", onError);
    stream.on("end", () => onEnd(entryBytes));
  });
}
