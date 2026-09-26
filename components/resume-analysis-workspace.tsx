"use client";

import { useRef, useState } from "react";
import { ResumeDocumentPanel } from "@/components/resume-document-panel";
import type { AnalysisResult } from "@/features/analysis/contracts";
import { PROFESSIONAL_AREAS, type ProfessionalArea } from "@/features/analysis/areas";
import { getCurriculumCtaCopy } from "@/features/analysis/curriculum-cta";
import type { AnalysisProviderMode } from "@/features/analysis/providers/types";
import type { ProcessedResumeDocument, ResumeUploadState } from "@/features/documents/types";
import Link from "next/link";

const categoryLabels = [
  ["experience", "Experiência"],
  ["technologies", "Tecnologias"],
  ["projects", "Projetos"],
  ["clarity", "Clareza"],
  ["positioning", "Posicionamento"],
] as const;

function statusLabel(status: string) {
  if (status === "good") return "BEM APRESENTADO";
  if (status === "needs_attention") return "PODE FICAR MAIS CLARO";
  if (status === "not_mentioned") return "NÃO MENCIONADO";
  return "POUCO CLARO";
}

export function ResumeAnalysisWorkspace({ mode }: { mode: AnalysisProviderMode }) {
  const [document, setDocument] = useState<ProcessedResumeDocument | null>(null);
  const [uploadState, setUploadState] = useState<ResumeUploadState>("idle");
  const [area, setArea] = useState<ProfessionalArea | "">("");
  const [role, setRole] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function handleDocumentChange(nextDocument: ProcessedResumeDocument | null) {
    setDocument(nextDocument);
    setAnalysis(null);
    setError("");
    setConfirmed(false);
  }

  async function submitAnalysis() {
    if (!document || !area || role.trim().length < 2 || !confirmed || inFlight.current) return;
    inFlight.current = true;
    setIsAnalyzing(true);
    setError("");
    setAnalysis(null);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extractedText: document.extractedText, area, role: role.trim(), analysisConfirmed: true }),
      });
      const payload = await response.json() as { analysis?: AnalysisResult; mode?: AnalysisProviderMode; error?: unknown };
      if (!response.ok || !payload.analysis || payload.mode !== mode) {
        const safeMessage = typeof payload.error === "string" && payload.error.length <= 180
          ? payload.error
          : "Não foi possível concluir a análise. Tente novamente.";
        throw new Error(safeMessage);
      }
      setAnalysis(payload.analysis);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a análise. Tente novamente.");
    } finally {
      inFlight.current = false;
      setIsAnalyzing(false);
    }
  }

  const canSubmit = Boolean(document && area && role.trim().length >= 2 && confirmed && !isAnalyzing && uploadState === "success");

  return (
    <>
      <ResumeDocumentPanel analysisMode={mode} onDocumentChange={handleDocumentChange} onStateChange={setUploadState} />

      <section className="analysis-context" aria-label="Contexto profissional">
        <div className="analysis-context-heading"><div><p className="analysis-eyebrow">CONTEXTO PROFISSIONAL</p><h2>Qual é o seu próximo objetivo?</h2></div><span>Necessário para analisar</span></div>
        <div className="analysis-context-fields">
          <label><span>Área profissional</span><select value={area} onChange={(event) => setArea(event.target.value as ProfessionalArea | "")} disabled={isAnalyzing}>
            <option value="">Selecione uma área</option>{PROFESSIONAL_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <label><span>Cargo desejado</span><input value={role} onChange={(event) => setRole(event.target.value)} maxLength={120} placeholder="Ex.: Engenheira de software" disabled={isAnalyzing} /></label>
        </div>
      </section>

      {!analysis && (
        <section className="analysis-empty" aria-live="polite">
          <span className="analysis-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 3.75h6.5L19 9.2v11.05H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M13 4v5.5h5.5M9 13h6m-6 3.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
          <div><p className="analysis-eyebrow">DIAGNÓSTICO</p><h2>{isAnalyzing ? "Analisando seu currículo…" : document ? "Seu currículo está pronto para análise." : "Envie seu currículo para começar."}</h2><p>{isAnalyzing ? "Estamos verificando as informações encontradas e suas evidências." : document ? "Escolha sua área e cargo desejado. A análise só começa após sua confirmação." : "Após o envio, confira o texto extraído e defina o objetivo profissional."}</p></div>
          <span className="analysis-demo-badge">{mode === "demo" ? "MODO DEMONSTRAÇÃO" : "ANÁLISE COM IA"}</span>
          <span className="analysis-not-analyzed">— <small>NOT ANALYZED</small></span>
          {document && <button className="analysis-submit" type="button" disabled={!canSubmit} onClick={submitAnalysis}>{isAnalyzing ? "ANALISANDO…" : "ANALISAR CURRÍCULO"}<span aria-hidden="true">→</span></button>}
        </section>
      )}

      {document && !analysis && <section className="analysis-consent">
        <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={isAnalyzing} />
          <span>{mode === "demo"
            ? "Entendi que esta é uma análise demonstrativa determinística. O texto é processado pelo servidor da aplicação e não é enviado à OpenAI nem a outros serviços externos. O resultado não será salvo pela aplicação."
            : <>Entendi que, ao iniciar, o texto extraído do currículo será enviado à OpenAI para gerar este diagnóstico. Contatos diretos detectáveis são removidos antes do envio. A OpenAI pode manter registros técnicos conforme sua <a href="https://platform.openai.com/docs/models/default-usage-policies-by-endpoint" target="_blank" rel="noreferrer">política de dados da API</a>. O resultado fica somente nesta sessão e não será salvo pela aplicação.</>}
          </span>
        </label>
      </section>}

      {error && <p role="alert" className="analysis-upload-error analysis-api-error">{error}</p>}

      {analysis && <AnalysisResults result={analysis} mode={mode} />}
    </>
  );
}

function AnalysisResults({ result, mode }: { result: AnalysisResult; mode: AnalysisProviderMode }) {
  return <section className="analysis-results" aria-live="polite">
    <div className="analysis-results-heading"><div><p className="analysis-eyebrow">DIAGNÓSTICO DO CURRÍCULO</p><h2>Análise concluída</h2></div><div className="analysis-result-badges"><span className="analysis-demo-badge">{mode === "demo" ? "MODO DEMONSTRAÇÃO" : "ANÁLISE COM IA"}</span><span>SEM PONTUAÇÃO AUTOMÁTICA</span></div></div>
    <div className="analysis-result-summary"><h3>Resumo</h3><p>{result.summary.text}</p><Evidence items={result.summary.evidence} /></div>
    <div className="analysis-category-grid">{categoryLabels.map(([key, label]) => {
      const category = result.categories[key];
      return <article className="analysis-category" key={key}><span>{label}</span><strong data-status={category.status}>{statusLabel(category.status)}</strong><p>{category.explanation}</p><Evidence items={category.evidence} /></article>;
    })}</div>
    <ResultList title="Pontos positivos" items={result.strengths.map((item) => ({ title: item.title, description: item.description, evidence: item.evidence }))} />
    <ResultList title="Pontos de atenção" items={result.improvements.map((item) => ({ title: item.title, description: item.description, evidence: item.evidence }))} />
    <ResultList title="Tecnologias encontradas" items={result.technologies.map((item) => ({ title: item.name, description: item.context, evidence: item.evidence }))} />
    <ResultList title="Experiências identificadas" items={result.experiences.map((item) => ({ title: [item.role, item.company].filter(Boolean).join(" · ") || "Experiência", description: [item.period, item.summary].filter(Boolean).join(" — "), evidence: item.evidence }))} />
    <ResultList title="Projetos identificados" items={result.projects.map((item) => ({ title: item.name ?? "Projeto", description: item.description, evidence: item.evidence }))} />
    <ResultList title="Formação" items={result.education.map((item) => ({ title: item.name, description: [item.institution, item.period].filter(Boolean).join(" · "), evidence: item.evidence }))} />
    <ResultList title="Certificações" items={result.certifications.map((item) => ({ title: item.name, description: [item.issuer, item.period].filter(Boolean).join(" · "), evidence: item.evidence }))} />
    <ResultList title="Sugestões para revisar" items={result.recommendations} />
    <p className="analysis-results-note">As observações se referem ao conteúdo encontrado no currículo enviado. Uma informação não mencionada aqui não significa que você não tenha essa competência.</p>
    <section className="analysis-next-step" aria-labelledby="analysis-next-step-title">
      <p className="analysis-eyebrow">PRÓXIMA ETAPA</p>
      <h3 id="analysis-next-step-title">Seu currículo pode ir além do diagnóstico.</h3>
      <p>{getCurriculumCtaCopy(result)}</p>
      <Link className="analysis-next-step-button" href="/curriculo">✨ Criar meu currículo otimizado <span aria-hidden="true">→</span></Link>
      <small>Usaremos somente as informações fornecidas por você. Nada será inventado.</small>
    </section>
  </section>;
}

function ResultList({ title, items }: { title: string; items: Array<{ title: string; description: string; evidence: string[] }> }) {
  if (items.length === 0) return null;
  return <div className="analysis-result-list"><h3>{title}</h3><div>{items.map((item, index) => <article key={`${item.title}-${index}`}><strong>{item.title}</strong><p>{item.description}</p><Evidence items={item.evidence} /></article>)}</div></div>;
}

function Evidence({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return <blockquote className="analysis-evidence">“{items.join("” · “")}”</blockquote>;
}
