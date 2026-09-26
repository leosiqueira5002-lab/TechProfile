"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ArrowIcon } from "@/components/arrow-icon";
import type { ProcessedResumeDocument, ResumeUploadState } from "@/features/documents/types";
import type { AnalysisProviderMode } from "@/features/analysis/providers/types";

type ResumeUploaderProps = {
  analysisMode: AnalysisProviderMode;
  onDocumentChange?: (document: ProcessedResumeDocument | null) => void;
  onStateChange?: (state: ResumeUploadState) => void;
};

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function formatFileType(name: string): string {
  const extension = name.replace(/\\/g, "/").split("/").pop()?.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "PDF";
  if (extension === "docx") return "DOCX";
  return "ARQ";
}

function validateFile(file: File): string | undefined {
  const safeName = file.name.replace(/\\/g, "/").split("/").pop() ?? "";
  const extension = safeName.split(".").pop()?.toLowerCase() ?? "";
  if (!(extension in MIME_BY_EXTENSION)) return "Formato não aceito. Escolha um arquivo PDF ou DOCX.";
  if (file.size <= 0) return "O arquivo está vazio. Escolha outro currículo.";
  if (file.size > MAX_FILE_BYTES) return "O arquivo ultrapassa o limite de 4 MB.";
  if (file.type !== MIME_BY_EXTENSION[extension]) {
    return "O tipo informado pelo navegador não corresponde à extensão do arquivo.";
  }
  return undefined;
}

export function ResumeUploader({ analysisMode, onDocumentChange, onStateChange }: ResumeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const processingStartedAt = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ResumeUploadState>("idle");
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [document, setDocument] = useState<ProcessedResumeDocument>();
  const [isDragging, setIsDragging] = useState(false);

  function changeState(nextState: ResumeUploadState) {
    setState(nextState);
    onStateChange?.(nextState);
  }

  function selectFile(nextFile?: File) {
    if (state === "uploading" || state === "processing") return;
    setDocument(undefined);
    onDocumentChange?.(null);
    setError(undefined);
    setProgress(0);
    if (!nextFile) {
      setFile(null);
      changeState("idle");
      return;
    }

    setFile(nextFile);
    changeState("validating");
    const validationError = validateFile(nextFile);
    if (validationError) {
      setError(validationError);
      changeState("error");
      return;
    }
    window.setTimeout(() => upload(nextFile), 180);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  function upload(fileToUpload: File) {
    if (state === "uploading" || state === "processing") return;

    setError(undefined);
    setProgress(0);
    changeState("uploading");

    const formData = new FormData();
    formData.append("file", fileToUpload);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/resumes");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.upload.onload = () => {
      processingStartedAt.current = Date.now();
      changeState("processing");
    };
    request.onload = () => {
      const payload = request.response as { document?: ProcessedResumeDocument; error?: unknown } | null;
      if (request.status < 200 || request.status >= 300 || !payload?.document || typeof payload.document.extractedText !== "string") {
        const message = typeof payload?.error === "string"
          ? payload.error
          : "Não foi possível processar o arquivo. Tente novamente.";
        setError(message);
        changeState("error");
        return;
      }

      const processedDocument = payload.document;
      const finishProcessing = () => {
        setDocument(processedDocument);
        onDocumentChange?.(processedDocument);
        setProgress(100);
        changeState("success");
      };
      const elapsed = Date.now() - (processingStartedAt.current ?? Date.now());
      window.setTimeout(finishProcessing, Math.max(0, 350 - elapsed));
    };
    request.onerror = () => {
      setError("A conexão foi interrompida. Verifique sua internet e tente novamente.");
      changeState("error");
    };
    request.onabort = () => {
      setError("O envio foi interrompido. Você pode tentar novamente.");
      changeState("error");
    };
    request.send(formData);
  }

  const isBusy = state === "uploading" || state === "processing";

  return (
    <div className="analysis-uploader">
      <div
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={onDrop}
        className={`analysis-dropzone ${isDragging ? "is-dragging" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          aria-label="Selecionar currículo em PDF ou DOCX"
          onChange={onFileChange}
        />
        <span aria-hidden="true" className="analysis-upload-symbol">
          <svg className="size-6" viewBox="0 0 24 24" fill="none">
            <path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v4.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="analysis-upload-title">
          {state === "success" ? "Currículo carregado" : "Arraste seu currículo até aqui"}
        </h2>
        <p className="analysis-upload-copy">{state === "success" ? "Seu documento está pronto para a próxima etapa." : "ou selecione um arquivo no seu dispositivo"}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          className="analysis-upload-trigger"
        >
          Selecionar arquivo <ArrowIcon className="size-4" />
        </button>
        <p className="analysis-upload-constraints">PDF ou DOCX · até 4 MB · PDF com até 20 páginas</p>
      </div>

      {file && (
        <div className="analysis-file-card">
          <span aria-hidden="true" className="analysis-file-ext">
            {formatFileType(file.name)}
          </span>
          <div className="analysis-file-meta">
            <p className="analysis-file-name">{file.name}</p>
            <p className="analysis-file-size">{formatFileSize(file.size)}</p>
          </div>
          {isBusy && <p className="analysis-upload-progress-text">{state === "uploading" ? `Enviando ${progress}%` : "Lendo currículo…"}</p>}
          {state === "success" && <p className="analysis-upload-success">CURRÍCULO CARREGADO</p>}
        </div>
      )}

      {document && (
        <p className="analysis-document-metadata">
          {document.format.toUpperCase()}{document.pageCount === null ? "" : ` · ${document.pageCount} ${document.pageCount === 1 ? "página" : "páginas"}`} · {formatFileSize(document.sizeBytes)}
        </p>
      )}

      {isBusy && (
        <div aria-live="polite" className="analysis-progress">
          <div className="analysis-progress-track">
            <div className={`analysis-progress-bar ${state === "processing" ? "is-processing" : ""}`} style={state === "uploading" ? { width: `${progress}%` } : undefined} />
          </div>
          <p>{state === "uploading" ? "Enviando arquivo com segurança…" : "Verificando a integridade, as páginas e lendo o currículo…"}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="analysis-upload-error">
          {error}
        </p>
      )}

      {document && (
        <section aria-labelledby="preview-title" className="analysis-result">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="analysis-result-kicker">Prévia de extração</p>
              <h2 id="preview-title" className="analysis-result-title">Confira o texto encontrado</h2>
            </div>
            <span className="analysis-result-status">Extração concluída</span>
          </div>
          <p aria-live="polite" className="analysis-result-explanation">
            {document.storage.persisted
              ? "O arquivo original foi salvo no armazenamento privado da sua conta. O texto extraído está preparado para revisão antes de qualquer análise."
              : "O arquivo e o texto foram processados nesta sessão, sem persistência em conta. Confira o conteúdo antes de iniciar a análise."}
          </p>
          <pre className="analysis-result-text">{document.extractedText}</pre>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="analysis-result-reset"
          >
            SUBSTITUIR CURRÍCULO
          </button>
        </section>
      )}

      <p className="analysis-privacy-note">{analysisMode === "demo"
        ? "O modo demonstração processa o texto neste servidor e não envia seu currículo a serviços externos."
        : "Seu currículo é informação privada. Você escolhe se deseja enviar o texto extraído para a análise por IA."}</p>
    </div>
  );
}
