export type ProcessedResumeDocument = {
  id: string;
  originalName: string;
  format: "pdf" | "docx";
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  extractedText: string;
  status: "processed";
  uploadedAt: string;
  processedAt: string;
  storage: {
    persisted: boolean;
    provider: "supabase" | "temporary";
  };
};

export type ResumeUploadState = "idle" | "validating" | "uploading" | "processing" | "success" | "error";
