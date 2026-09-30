"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ResumeDraft } from "./types.ts";

type ResumeDraftContextValue = {
  draft: ResumeDraft | null;
  setDraft: (draft: ResumeDraft | null) => void;
  canExportPdf: boolean;
  canGenerateResume: boolean;
};

const ResumeDraftContext = createContext<ResumeDraftContextValue | null>(null);

export function ResumeDraftProvider({
  children,
  canExportPdf,
  canGenerateResume,
}: {
  children: ReactNode;
  canExportPdf: boolean;
  canGenerateResume: boolean;
}) {
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  return <ResumeDraftContext.Provider value={{ draft, setDraft, canExportPdf, canGenerateResume }}>{children}</ResumeDraftContext.Provider>;
}

export function useResumeDraftContext(): ResumeDraftContextValue {
  const context = useContext(ResumeDraftContext);
  if (!context) throw new Error("ResumeDraftProvider não encontrado.");
  return context;
}
