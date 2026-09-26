"use client";

import { useState } from "react";
import { ResumeUploader } from "@/components/resume-uploader";
import type { ProcessedResumeDocument, ResumeUploadState } from "@/features/documents/types";
import type { AnalysisProviderMode } from "@/features/analysis/providers/types";

type ResumeDocumentPanelProps = {
  analysisMode: AnalysisProviderMode;
  onDocumentChange?: (document: ProcessedResumeDocument | null) => void;
  onStateChange?: (state: ResumeUploadState) => void;
};
import { ArrowIcon } from "@/components/arrow-icon";

function labelForState(state: ResumeUploadState): string {
  if (state === "validating") return "VALIDANDO DOCUMENTO";
  if (state === "uploading") return "ENVIANDO DOCUMENTO";
  if (state === "processing") return "LENDO CURRÍCULO";
  if (state === "success") return "CURRÍCULO CARREGADO";
  if (state === "error") return "ERRO NO DOCUMENTO";
  return "AGUARDANDO CURRÍCULO";
}

export function ResumeDocumentPanel({ analysisMode, onDocumentChange, onStateChange }: ResumeDocumentPanelProps) {
  const [document, setDocument] = useState<ProcessedResumeDocument | null>(null);
  const [state, setState] = useState<ResumeUploadState>("idle");

  return (
    <section className="document-section" id="resume" aria-labelledby="document-heading">
      <div className="content-section-heading">
        <div>
          <p>DOCUMENTO ATUAL</p>
          <h2 id="document-heading" title={document?.originalName}>
            {document?.originalName ?? "Comece pelo seu currículo"}
          </h2>
        </div>
        <span className="document-secure">
          <ArrowIcon className="size-3" /> {document ? "CURRÍCULO CARREGADO" : "ARQUIVO PRIVADO"}
        </span>
      </div>
      <p className="analysis-document-state" aria-live="polite">
        <i className={state === "error" ? "is-error" : state === "success" ? "is-success" : ""} />
        STATUS · {labelForState(state)}
      </p>
      <ResumeUploader
        analysisMode={analysisMode}
        onDocumentChange={(nextDocument) => { setDocument(nextDocument); onDocumentChange?.(nextDocument); }}
        onStateChange={(nextState) => { setState(nextState); onStateChange?.(nextState); }}
      />
    </section>
  );
}
