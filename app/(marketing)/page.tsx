import { ArrowIcon } from "@/components/arrow-icon";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";

function StatusDot() {
  return <span className="status-dot" aria-hidden="true" />;
}

function MiniIcon({ type }: { type: "file" | "linkedin" | "target" }) {
  if (type === "file") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M7 3.75h6.5L19 9.2v11.05H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M13 4v5.5h5.5M9 13h6m-6 3.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
  if (type === "linkedin") return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 10v6m0-8v.01M11.5 16v-3.2a2 2 0 0 1 4 0V16m-4-3.2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>;
}

function ProfileDashboard() {
  return (
    <div className="dashboard-shell">
      <section className="dashboard-card" aria-label="Exemplo visual demonstrativo da plataforma">
        <div className="dashboard-bar"><div className="dashboard-product"><span className="dashboard-mark">TP</span> PROFILE WORKSPACE</div><span className="demo-label">EXEMPLO VISUAL</span></div>
        <div className="dashboard-body">
          <div className="dashboard-title-row"><div><p className="micro-label">PROFILE ANALYSIS</p><h2>Seu perfil profissional</h2></div><span className="system-code">EXEMPLO<br/>DEMONSTRATIVO</span></div>
          <div className="score-panel"><div className="score-copy"><p className="micro-label">CURRÍCULO + LINKEDIN</p><p className="score-sub">Informações para uma apresentação consistente</p></div></div>
          <div className="dashboard-lower">
            <div className="dimensions-panel"><div className="panel-heading"><span className="micro-label">CURRÍCULO</span><MiniIcon type="file"/></div>{["Experiência", "Tecnologias", "Projetos"].map((item) => <div className="dimension" key={item}><div className="dimension-meta"><span>{item}</span><span>Incluído</span></div><div className="dimension-track"><span style={{ width: "100%" }} /></div></div>)}<p className="illustrative-note">Seções ilustrativas, sem resultado de análise.</p></div>
            <div className="profile-panel"><div className="panel-heading"><span className="micro-label">LINKEDIN</span><MiniIcon type="linkedin"/></div><div className="signal-list">{["Headline", "Sobre", "Skills"].map((item) => <span key={item}><b>✓</b> {item}</span>)}</div><div className="profile-separator"/><div className="panel-heading"><span className="micro-label">CARGO DESEJADO</span><span className="target-icon"><MiniIcon type="target"/></span></div><p className="target-role">Full Stack Developer</p><span className="target-tag">EXEMPLO CONCEITUAL</span></div>
          </div>
          <div className="dashboard-foot"><span><StatusDot/> PRÉVIA CONCEITUAL</span><span>SEM DADOS REAIS DE USUÁRIOS</span></div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <main id="inicio" className="site-shell">
      <SiteHeader />
      <section className="hero-section">
        <div className="hero-layout">
          <div className="hero-content">
            <div className="hero-eyebrow">AI PARA CARREIRA EM TECNOLOGIA</div>
            <h1>Transforme seu currículo em uma <span>vantagem profissional.</span></h1>
            <p className="hero-description">Analise seu currículo, melhore seu posicionamento e descubra como apresentar melhor sua experiência para o mercado de tecnologia.</p>
            <div className="hero-buttons"><a className="button-primary" href="/analise">Analisar meu currículo <ArrowIcon className="size-4"/></a><a className="button-secondary" href="#como-funciona">Ver como funciona <span aria-hidden="true">↓</span></a></div>
            <div className="hero-meta"><span>Seu conteúdo continua sob seu controle</span><span>Feito para carreiras em tecnologia</span></div>
          </div>
          <div className="hero-dashboard"><ProfileDashboard/></div>
        </div>
      </section>

      <section id="como-funciona" className="feature-section resume-section">
        <div className="content-container">
          <div className="section-topline"><span>COMO FUNCIONA</span><span>TRÊS PASSOS PARA COMEÇAR</span></div>
          <div className="feature-grid">
            <div className="feature-copy"><p className="micro-label">UMA EXPERIÊNCIA SIMPLES E OBJETIVA</p><h2>Uma apresentação profissional mais clara começa pelo que você já construiu.</h2><p>O TechProfile AI organiza as informações que você fornece e ajuda a comunicar sua experiência com mais contexto.</p><a className="text-link" href="/analise">Comece pelo seu currículo <ArrowIcon className="size-4"/></a></div>
            <div className="metric-board" aria-label="Etapas do produto">
              <div className="metric-board-head"><span>SEU CAMINHO</span><span className="metric-time">01 — 03</span></div>
              <div className="metric-rows">{[{ n: "01", label: "Envie seu currículo" }, { n: "02", label: "Receba uma análise inteligente" }, { n: "03", label: "Melhore seu posicionamento profissional" }].map((item) => <div className="metric-row" key={item.n}><span>{item.n}</span><div>{item.label}</div><b>→</b></div>)}</div>
              <div className="metric-board-foot"><span>Você revisa as informações antes de usá-las.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="curriculo" className="feature-section linkedin-section">
        <div className="content-container linkedin-layout">
          <div className="linkedin-visual"><div className="linkedin-window"><div className="window-chrome"><span className="window-controls"><i/><i/><i/></span><span>RESUME / EXAMPLE</span><span className="window-lock">DEMONSTRAÇÃO</span></div><div className="linkedin-profile"><div className="profile-cover"><div className="cover-grid"/></div><div className="profile-avatar">CV</div><div className="linkedin-card-copy"><p className="micro-label">VISÃO DO CURRÍCULO</p><div className="linkedin-checks"><span><b>01</b> Pontos fortes</span><span><b>02</b> Pontos de atenção</span><span><b>03</b> Tecnologias e experiência</span><span><b>04</b> Projetos</span></div></div></div><div className="linkedin-status"><span>EXEMPLO CONCEITUAL</span><span>SEM RESULTADOS FICTÍCIOS</span></div></div></div>
          <div className="linkedin-copy"><div className="section-topline"><span>SEU CURRÍCULO</span><span>01 / PERFIL</span></div><p className="micro-label">PONTOS FORTES · ATENÇÃO · EXPERIÊNCIA</p><h2>Seu currículo, analisado de verdade.</h2><p>Entenda como sua experiência, tecnologias e projetos aparecem no documento. O fluxo atual permite enviar o currículo e conferir o texto extraído antes de uma futura análise.</p><div className="linkedin-checks"><span><b>✓</b> Leitura do conteúdo enviado</span><span><b>✓</b> Você confere o texto extraído</span><span><b>→</b> Análise inteligente em etapa futura</span></div></div>
        </div>
      </section>

      <section id="linkedin" className="feature-section position-section">
        <div className="content-container">
          <div className="section-topline"><span>LINKEDIN</span><span>02 / PRESENÇA PROFISSIONAL</span></div>
          <div className="position-heading"><div><p className="micro-label">CURRÍCULO E PERFIL PROFISSIONAL</p><h2>Seu LinkedIn também faz parte do seu currículo.</h2></div><p>Uma futura etapa poderá ajudar a revisar como headline, sobre, experiência, projetos e skills apresentam sua trajetória.</p></div>
          <div className="position-flow linkedin-sections">{["Foto e banner", "Headline e sobre", "Experiência e projetos", "Skills"].map((item, index) => <article className="position-node" key={item}><div className="position-node-top"><span>SEÇÃO 0{index + 1}</span><MiniIcon type={index === 0 ? "file" : "linkedin"}/></div><p className="micro-label">LINKEDIN</p><h3>{item}</h3><span className="node-state">Exemplo conceitual</span></article>)}</div>
          <p className="position-caption"><span>VISÃO FUTURA</span> A análise do LinkedIn ainda não está disponível.</p>
        </div>
      </section>

      <section id="vaga" className="feature-section before-after-section">
        <div className="content-container before-after-layout">
          <div className="before-copy"><div className="section-topline"><span>OBJETIVO PROFISSIONAL</span><span>03 / VAGA</span></div><p className="micro-label">PERFIL + OPORTUNIDADE</p><h2>Compare seu perfil com a vaga que você deseja.</h2><p>Quando essa etapa estiver disponível, o contexto da vaga poderá ser considerado junto das informações que você enviar.</p></div>
          <div className="rewrite-card"><div className="rewrite-card-head"><span>ANÁLISE DE COMPATIBILIDADE</span><span className="demo-label">CONCEITO</span></div><div className="rewrite-line"><span className="rewrite-tag">SEU PERFIL</span><p>Experiência e competências informadas por você.</p></div><div className="rewrite-divider"><span/><b>+</b><span/></div><div className="rewrite-line rewrite-line-after"><span className="rewrite-tag">VAGA</span><p>Requisitos e contexto da oportunidade.</p></div><div className="rewrite-card-foot"><span>SEM PERCENTUAIS OU SCORES FICTÍCIOS</span><span>ETAPA FUTURA</span></div></div>
        </div>
      </section>

      <section id="recursos" className="feature-section resume-section">
        <div className="content-container before-after-layout">
          <div className="before-copy"><div className="section-topline"><span>TRANSPARÊNCIA</span><span>FATOS EM PRIMEIRO LUGAR</span></div><p className="micro-label">SUA HISTÓRIA CONTINUA SENDO SUA</p><h2>A IA não inventa sua experiência.</h2><p>O TechProfile AI trabalha com as informações que você realmente forneceu. Se uma tecnologia ou experiência não estiver no currículo, isso será tratado como informação não mencionada — nunca como algo que você não sabe.</p></div>
          <div className="transparency-panel"><div className="transparency-icon"><svg aria-hidden="true" viewBox="0 0 48 48" fill="none"><path d="M24 5 39 11v11c0 10-6.3 17-15 21C15.3 39 9 32 9 22V11l15-6Z" stroke="currentColor" strokeWidth="1.7"/><path d="m17 24 4.5 4.5L31 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="transparency-copy"><p className="micro-label">COMPROMISSO COM A FIDELIDADE</p><h2>Organizar sem distorcer.</h2><div className="transparency-list"><span><b>01</b> Sem experiências inventadas</span><span><b>02</b> Ausência significa “não mencionado”</span><span><b>03</b> Você mantém controle do seu conteúdo</span></div></div></div>
        </div>
      </section>

      <section className="closing-section"><div className="closing-content"><p className="micro-label">TECHPROFILE AI</p><h2>Pronto para melhorar seu posicionamento profissional?</h2><p>Comece com o currículo que você já tem.</p><a className="button-main" href="/analise">Analisar meu currículo <ArrowIcon className="size-4"/></a></div></section>
      <footer className="site-footer"><div className="footer-inner"><Brand/><p>Carreira em tecnologia, apresentada com clareza.</p><a href="#inicio">Voltar ao início ↑</a><span className="footer-code">TechProfile AI</span></div></footer>
    </main>
  );
}
