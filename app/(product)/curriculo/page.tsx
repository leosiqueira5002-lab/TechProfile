import { ResumeBuilderFromContext } from "@/features/resume/components/resume-builder-from-context";
import "../analise/analysis.css";
import "@/features/resume/resume-builder.css";

export const metadata = {
  title: "Criar currículo otimizado — TechProfile AI",
  description: "Organize suas informações profissionais em um currículo editável.",
};

export default function OptimizedResumePage() {
  return (
    <div className="analysis-page">
      <main className="analysis-main">
        <div className="analysis-content curriculum-builder-content">
          <header className="analysis-page-header">
            <div>
              <p className="analysis-eyebrow">CRIADOR DE CURRÍCULO</p>
              <h1>Criar currículo otimizado</h1>
              <p>Preencha suas informações e acompanhe a prévia do currículo enquanto edita.</p>
            </div>
            <span className="analysis-current-status"><i />Rascunho em memória</span>
          </header>
          <p className="curriculum-preparation-note">Este rascunho existe apenas enquanto esta página estiver aberta; ele não será salvo ao sair.</p>
          <ResumeBuilderFromContext />
        </div>
      </main>
    </div>
  );
}
