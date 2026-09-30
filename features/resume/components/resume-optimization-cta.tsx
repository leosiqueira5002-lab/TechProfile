"use client";

import { useMemo, useState } from "react";
import { SubscribeProButton } from "@/components/subscribe-pro-button";
import { createResumeOptimizationAction } from "../optimization-client";
import type { ResumeDraft } from "../types";

type Props = {
  isPro: boolean;
  input: { extractedText: string; area: string; role: string };
  onGeneratedDraft: (draft: ResumeDraft) => void;
  onNavigate: (path: string) => void;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
};

export function ResumeOptimizationCta({ isPro, input, onGeneratedDraft, onNavigate, fetchImpl }: Props) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const action = useMemo(() => createResumeOptimizationAction({
    fetchImpl: fetchImpl ?? ((url, init) => fetch(url, init)),
    onLoadingChange: setLoading,
    onError: setError,
    setDraft: onGeneratedDraft,
    navigate: onNavigate,
  }), [fetchImpl, onGeneratedDraft, onNavigate]);

  return (
    <section className="analysis-next-step" aria-labelledby="resume-optimization-title">
      <p className="analysis-eyebrow">CURRÍCULO OTIMIZADO</p>
      <h3 id="resume-optimization-title">Transforme o diagnóstico em uma apresentação profissional.</h3>
      <p>Gere uma proposta editável com base no currículo enviado e revise cada informação antes de usar.</p>
      {isPro ? <>
        <label className="resume-optimization-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={loading} />
          <span>Ao continuar, o texto extraído será enviado ao Google Gemini. Identificadores diretos, como nome, contatos e links, são removidos antes do envio. O resultado fica somente nesta sessão e deve ser revisado por você. O Google pode processar dados em outros países e manter registros por tempo limitado para segurança e prevenção de abuso.</span>
        </label>
        <button className="analysis-next-step-button" type="button" disabled={!consent || loading} aria-busy={loading} onClick={() => { void action(input); }}>
          {loading ? "Gerando currículo…" : "Gerar currículo otimizado com IA"}
          {!loading && <span aria-hidden="true">→</span>}
        </button>
        {error && <p className="analysis-upload-error analysis-api-error" role="alert">{error}</p>}
      </> : <>
        <span className="analysis-demo-badge">DISPONÍVEL NO PRO</span>
        <p>Monte uma proposta editável de currículo com base nas informações encontradas.</p>
        <SubscribeProButton label="Assinar Pro — R$ 19,90" />
      </>}
      <small>As informações serão usadas como base para uma sugestão editável. Revise o conteúdo antes de exportar.</small>
    </section>
  );
}
