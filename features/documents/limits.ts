export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4.5 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
export const MAX_DOCX_ENTRIES = 500;
export const MAX_DOCX_EXPANDED_BYTES = 20 * 1024 * 1024;
export const MAX_DOCX_EXPANSION_RATIO = 100;
export const MAX_EXTRACTED_CHARACTERS = 200_000;
export const EXTRACTION_TIMEOUT_MS = 15_000;

export const MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ResumeFormat = keyof typeof MIME_TYPES;
