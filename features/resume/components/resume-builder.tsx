"use client";

import { useState } from "react";
import { canExportResume, createEmptyResumeDraft } from "../model.ts";
import { getResumeExportPresentation, runResumeExport } from "../export-access.ts";
import type { ResumeDraft } from "../types.ts";
import { SubscribeProButton } from "@/components/subscribe-pro-button";
import { ResumeEditor } from "./resume-editor.tsx";
import { ResumePreview } from "./resume-preview.tsx";

export function ResumeBuilder({
  initialValue,
  canExportPdf = false,
}: {
  initialValue?: ResumeDraft;
  canExportPdf?: boolean;
}) {
  const [draft, setDraft] = useState<ResumeDraft>(() => initialValue ?? createEmptyResumeDraft());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const exportable = canExportResume(draft);
  const exportPresentation = getResumeExportPresentation(canExportPdf, exportable);

  function handleExportPdf() {
    runResumeExport({
      isPro: canExportPdf,
      hasContent: exportable,
      print: () => window.print(),
      onUpgrade: () => setShowUpgrade(true),
    });
  }

  return (
    <div className="resume-builder">
      <div className="resume-builder-toolbar">
        <div className="resume-builder-toolbar-copy">
          {canExportPdf && !exportable && <p className="resume-export-guidance">Preencha ao menos um campo para exportar o currículo.</p>}
          {!canExportPdf && <p className="resume-export-guidance">A exportação em PDF está disponível no Pro.</p>}
          {showUpgrade && exportPresentation.showUpgradeCta && (
            <aside className="resume-export-upgrade" aria-live="polite">
              <div>
                <strong>Exporte seu currículo profissional em PDF com o TechProfile Pro.</strong>
                <span>O pagamento é avulso e o acesso dura 30 dias.</span>
              </div>
              <SubscribeProButton label="Assinar Pro — R$ 19,90" />
            </aside>
          )}
        </div>
        <button
          aria-label={canExportPdf ? "Exportar como PDF" : "Disponível no Pro"}
          className="resume-export-button"
          type="button"
          title={canExportPdf ? undefined : "Disponível no Pro"}
          disabled={exportPresentation.buttonDisabled}
          onClick={handleExportPdf}
        >
          {exportPresentation.buttonLabel}
        </button>
      </div>
      <div className="resume-builder-grid">
        <ResumeEditor draft={draft} onChange={setDraft} />
        <section className="resume-preview-panel" aria-labelledby="resume-preview-heading">
          <div className="resume-preview-panel-heading">
            <div>
              <p className="resume-section-eyebrow">VISUALIZAÇÃO</p>
              <h2 id="resume-preview-heading">Prévia do currículo</h2>
            </div>
            <span>Atualizada em tempo real</span>
          </div>
          <ResumePreview draft={draft} />
        </section>
      </div>
    </div>
  );
}
