import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ResumeAnalysisWorkspace } from "@/components/resume-analysis-workspace";
import { analysisProvider } from "@/features/analysis/providers";
import "./analysis.css";

export const metadata = {
  title: "Análise do currículo — TechProfile AI",
  description: "Envie seu currículo e confira o texto extraído antes da análise.",
};

export default function ResumeAnalysisPage() {
  const analysisMode = analysisProvider.mode;

  return (
    <div className="analysis-page">
      <SiteHeader />
      <main className="analysis-main">
        <div className="analysis-content">
          <header className="analysis-page-header">
            <div><p className="analysis-eyebrow">ESPAÇO PROFISSIONAL</p><h1>Análise do currículo</h1><p>Veja como seu currículo está sendo apresentado profissionalmente.</p></div>
            <span className="analysis-current-status"><i aria-hidden="true"/> {analysisMode === "demo" ? "Modo demonstração" : "Análise por IA"}</span>
          </header>

          <div className="analysis-step"><span>ETAPA 01</span><span>SEU CURRÍCULO</span></div>
          <ResumeAnalysisWorkspace mode={analysisMode} />

          <footer className="analysis-footer"><span>{analysisMode === "demo" ? "O modo demonstração não envia o currículo a serviços externos." : "A análise só envia o texto extraído à OpenAI após sua confirmação."}</span><Link href="/#recursos">Saiba como tratamos seu conteúdo</Link></footer>
        </div>
      </main>
    </div>
  );
}
