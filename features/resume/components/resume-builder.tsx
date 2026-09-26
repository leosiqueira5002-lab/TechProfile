"use client";

import { useState } from "react";
import { createEmptyResumeDraft } from "../model.ts";
import type { ResumeDraft } from "../types.ts";
import { ResumeEditor } from "./resume-editor.tsx";
import { ResumePreview } from "./resume-preview.tsx";

export function ResumeBuilder({ initialValue }: { initialValue?: ResumeDraft }) {
  const [draft, setDraft] = useState<ResumeDraft>(() => initialValue ?? createEmptyResumeDraft());

  return (
    <div className="resume-builder">
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
