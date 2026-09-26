import { getVisibleResumeSections, hasResumeText } from "../model.ts";
import type { ResumeDraft } from "../types.ts";

function formatMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return value;

  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function DateRange({ start, end, isCurrent = false }: { start: string; end: string; isCurrent?: boolean }) {
  const formattedStart = formatMonth(start);
  const formattedEnd = isCurrent ? "Atual" : formatMonth(end);
  const range = [formattedStart, formattedEnd].filter(hasResumeText).join(" — ");
  return range ? <p className="resume-preview-dates">{range}</p> : null;
}

export function ResumePreview({ draft }: { draft: ResumeDraft }) {
  const visibleSections = getVisibleResumeSections(draft);
  const hasSection = (section: (typeof visibleSections)[number]) => visibleSections.includes(section);
  const experienceEntries = draft.experiences.filter((item) => [item.company, item.position, item.startDate, item.endDate, item.description].some(hasResumeText) || item.isCurrent);
  const educationEntries = draft.education.filter((item) => [item.institution, item.course, item.startDate, item.completionDate, item.status].some(hasResumeText));
  const projectEntries = draft.projects.filter((item) => [item.name, item.description, item.technologies, item.link].some(hasResumeText));
  const skillEntries = draft.skills.filter((item) => hasResumeText(item.name));
  const languageEntries = draft.languages.filter((item) => [item.name, item.proficiency].some(hasResumeText));
  const certificationEntries = draft.certifications.filter((item) => [item.name, item.issuer, item.year, item.url].some(hasResumeText));

  return (
    <article className="resume-preview-sheet" aria-label="Prévia do currículo">
      {hasSection("personalInfo") && (
        <header className="resume-preview-header">
          {hasResumeText(draft.personalInfo.fullName) && <h1>{draft.personalInfo.fullName}</h1>}
          {hasResumeText(draft.desiredRole) && <p className="resume-preview-role">{draft.desiredRole}</p>}
          <ul className="resume-preview-contact">
            {hasResumeText(draft.personalInfo.cityState) && <li>{draft.personalInfo.cityState}</li>}
            {hasResumeText(draft.personalInfo.email) && <li>{draft.personalInfo.email}</li>}
            {hasResumeText(draft.personalInfo.phone) && <li>{draft.personalInfo.phone}</li>}
            {hasResumeText(draft.personalInfo.linkedinUrl) && <li>{draft.personalInfo.linkedinUrl}</li>}
            {hasResumeText(draft.personalInfo.githubPortfolioUrl) && <li>{draft.personalInfo.githubPortfolioUrl}</li>}
          </ul>
        </header>
      )}
      {!hasSection("personalInfo") && hasSection("desiredRole") && (
        <header className="resume-preview-header"><p className="resume-preview-role">{draft.desiredRole}</p></header>
      )}

      {hasSection("summary") && <section className="resume-preview-section"><h2>Resumo profissional</h2><p className="resume-preview-paragraph">{draft.summary}</p></section>}

      {experienceEntries.length > 0 && (
        <section className="resume-preview-section">
          <h2>Experiência</h2>
          {experienceEntries.map((item) => (
            <div className="resume-preview-entry" key={item.id}>
              {(hasResumeText(item.position) || hasResumeText(item.company)) && <h3>{[item.position, item.company].filter(hasResumeText).join(" · ")}</h3>}
              <DateRange start={item.startDate} end={item.endDate} isCurrent={item.isCurrent} />
              {hasResumeText(item.description) && <p className="resume-preview-paragraph">{item.description}</p>}
            </div>
          ))}
        </section>
      )}

      {educationEntries.length > 0 && (
        <section className="resume-preview-section">
          <h2>Formação</h2>
          {educationEntries.map((item) => (
            <div className="resume-preview-entry" key={item.id}>
              {hasResumeText(item.course) && <h3>{item.course}</h3>}
              {hasResumeText(item.institution) && <p className="resume-preview-subtitle">{item.institution}</p>}
              <DateRange start={item.startDate} end={item.completionDate} />
              {hasResumeText(item.status) && <p className="resume-preview-paragraph">{item.status}</p>}
            </div>
          ))}
        </section>
      )}

      {projectEntries.length > 0 && (
        <section className="resume-preview-section">
          <h2>Projetos</h2>
          {projectEntries.map((item) => (
            <div className="resume-preview-entry" key={item.id}>
              {hasResumeText(item.name) && <h3>{item.name}</h3>}
              {hasResumeText(item.description) && <p className="resume-preview-paragraph">{item.description}</p>}
              {hasResumeText(item.technologies) && <p className="resume-preview-subtitle">Tecnologias: {item.technologies}</p>}
              {hasResumeText(item.link) && <p className="resume-preview-subtitle">{item.link}</p>}
            </div>
          ))}
        </section>
      )}

      {skillEntries.length > 0 && (
        <section className="resume-preview-section"><h2>Tecnologias e habilidades</h2><ul className="resume-preview-skills">{skillEntries.map((item) => <li key={item.id}>{item.name}</li>)}</ul></section>
      )}

      {languageEntries.length > 0 && (
        <section className="resume-preview-section">
          <h2>Idiomas</h2>
          <ul className="resume-preview-list">{languageEntries.map((item) => <li key={item.id}>{[item.name, item.proficiency].filter(hasResumeText).join(" · ")}</li>)}</ul>
        </section>
      )}

      {certificationEntries.length > 0 && (
        <section className="resume-preview-section">
          <h2>Certificações</h2>
          <ul className="resume-preview-list">{certificationEntries.map((item) => <li key={item.id}>{[item.name, item.issuer, item.year, item.url].filter(hasResumeText).join(" · ")}</li>)}</ul>
        </section>
      )}

      {visibleSections.length === 0 && (
        <p className="resume-preview-empty">Os campos preenchidos aparecerão aqui em tempo real.</p>
      )}
    </article>
  );
}
