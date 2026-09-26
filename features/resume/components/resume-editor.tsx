"use client";

import {
  isValidOptionalEmail,
  isValidOptionalUrl,
  removeResumeItem,
  RESUME_FIELD_LIMITS,
  updateResumeItem,
} from "../model.ts";
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  PersonalInfo,
  ProjectEntry,
  ResumeDraft,
  SkillEntry,
} from "../types.ts";

type ResumeEditorProps = {
  draft: ResumeDraft;
  onChange: (draft: ResumeDraft) => void;
};

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "tel" | "month";
  multiline?: boolean;
  disabled?: boolean;
  error?: string;
};

function TextField({
  id,
  label,
  value,
  maxLength,
  onChange,
  type = "text",
  multiline = false,
  disabled = false,
  error,
}: TextFieldProps) {
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <label className="resume-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && <span className="resume-field-error" id={describedBy} role="alert">{error}</span>}
    </label>
  );
}

function createId() {
  return crypto.randomUUID();
}

export function ResumeEditor({ draft, onChange }: ResumeEditorProps) {
  const setPersonalInfo = <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => {
    onChange({ ...draft, personalInfo: { ...draft.personalInfo, [key]: value } });
  };

  const updateExperience = (id: string, patch: Partial<ExperienceEntry>) => {
    onChange({ ...draft, experiences: updateResumeItem(draft.experiences, id, patch) });
  };
  const updateEducation = (id: string, patch: Partial<EducationEntry>) => {
    onChange({ ...draft, education: updateResumeItem(draft.education, id, patch) });
  };
  const updateProject = (id: string, patch: Partial<ProjectEntry>) => {
    onChange({ ...draft, projects: updateResumeItem(draft.projects, id, patch) });
  };
  const updateSkill = (id: string, patch: Partial<SkillEntry>) => {
    onChange({ ...draft, skills: updateResumeItem(draft.skills, id, patch) });
  };
  const updateLanguage = (id: string, patch: Partial<LanguageEntry>) => {
    onChange({ ...draft, languages: updateResumeItem(draft.languages, id, patch) });
  };
  const updateCertification = (id: string, patch: Partial<CertificationEntry>) => {
    onChange({ ...draft, certifications: updateResumeItem(draft.certifications, id, patch) });
  };

  const emailError = isValidOptionalEmail(draft.personalInfo.email) ? undefined : "Informe um e-mail válido.";
  const linkedinError = isValidOptionalUrl(draft.personalInfo.linkedinUrl) ? undefined : "Informe uma URL iniciada por http:// ou https://.";
  const profileLinkError = isValidOptionalUrl(draft.personalInfo.githubPortfolioUrl) ? undefined : "Informe uma URL iniciada por http:// ou https://.";

  return (
    <form className="resume-editor" onSubmit={(event) => event.preventDefault()}>
      <section className="resume-editor-section" aria-labelledby="resume-personal-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">01 · SEU PERFIL</p>
            <h2 id="resume-personal-heading">Dados pessoais</h2>
          </div>
        </div>
        <div className="resume-field-grid">
          <TextField id="resume-name" label="Nome" value={draft.personalInfo.fullName} maxLength={RESUME_FIELD_LIMITS.personalInfo.fullName} onChange={(value) => setPersonalInfo("fullName", value)} />
          <TextField id="resume-city-state" label="Cidade/Estado" value={draft.personalInfo.cityState} maxLength={RESUME_FIELD_LIMITS.personalInfo.cityState} onChange={(value) => setPersonalInfo("cityState", value)} />
          <TextField id="resume-email" label="E-mail" type="email" value={draft.personalInfo.email} maxLength={RESUME_FIELD_LIMITS.personalInfo.email} onChange={(value) => setPersonalInfo("email", value)} error={emailError} />
          <TextField id="resume-phone" label="Telefone" type="tel" value={draft.personalInfo.phone} maxLength={RESUME_FIELD_LIMITS.personalInfo.phone} onChange={(value) => setPersonalInfo("phone", value)} />
          <TextField id="resume-linkedin" label="LinkedIn" type="url" value={draft.personalInfo.linkedinUrl} maxLength={RESUME_FIELD_LIMITS.personalInfo.linkedinUrl} onChange={(value) => setPersonalInfo("linkedinUrl", value)} error={linkedinError} />
          <TextField id="resume-github-portfolio" label="GitHub/Portfólio" type="url" value={draft.personalInfo.githubPortfolioUrl} maxLength={RESUME_FIELD_LIMITS.personalInfo.githubPortfolioUrl} onChange={(value) => setPersonalInfo("githubPortfolioUrl", value)} error={profileLinkError} />
        </div>
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-goal-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">02 · DIREÇÃO</p>
            <h2 id="resume-goal-heading">Objetivo profissional</h2>
          </div>
        </div>
        <TextField id="resume-desired-role" label="Cargo desejado" value={draft.desiredRole} maxLength={RESUME_FIELD_LIMITS.desiredRole} onChange={(value) => onChange({ ...draft, desiredRole: value })} />
        <TextField id="resume-summary" label="Resumo profissional" value={draft.summary} maxLength={RESUME_FIELD_LIMITS.summary} multiline onChange={(value) => onChange({ ...draft, summary: value })} />
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-experience-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">03 · TRAJETÓRIA</p>
            <h2 id="resume-experience-heading">Experiência</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, experiences: [...draft.experiences, { id: createId(), company: "", position: "", startDate: "", endDate: "", isCurrent: false, description: "" }] })}>+ Adicionar experiência</button>
        </div>
        {draft.experiences.map((experience, index) => (
          <fieldset className="resume-entry" key={experience.id}>
            <legend>Experiência {index + 1}</legend>
            <div className="resume-field-grid">
              <TextField id={`experience-company-${experience.id}`} label="Empresa" value={experience.company} maxLength={RESUME_FIELD_LIMITS.experiences.company} onChange={(value) => updateExperience(experience.id, { company: value })} />
              <TextField id={`experience-position-${experience.id}`} label="Cargo" value={experience.position} maxLength={RESUME_FIELD_LIMITS.experiences.position} onChange={(value) => updateExperience(experience.id, { position: value })} />
              <TextField id={`experience-start-${experience.id}`} label="Data inicial" type="month" value={experience.startDate} maxLength={RESUME_FIELD_LIMITS.experiences.startDate} onChange={(value) => updateExperience(experience.id, { startDate: value })} />
              <TextField id={`experience-end-${experience.id}`} label="Data final" type="month" value={experience.endDate} maxLength={RESUME_FIELD_LIMITS.experiences.endDate} disabled={experience.isCurrent} onChange={(value) => updateExperience(experience.id, { endDate: value })} />
              <label className="resume-checkbox-field">
                <input type="checkbox" checked={experience.isCurrent} onChange={(event) => updateExperience(experience.id, { isCurrent: event.target.checked, endDate: event.target.checked ? "" : experience.endDate })} />
                <span>Atualmente</span>
              </label>
              <TextField id={`experience-description-${experience.id}`} label="Descrição" value={experience.description} maxLength={RESUME_FIELD_LIMITS.experiences.description} multiline onChange={(value) => updateExperience(experience.id, { description: value })} />
            </div>
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, experiences: removeResumeItem(draft.experiences, experience.id) })}>Remover experiência</button>
          </fieldset>
        ))}
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-education-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">04 · FORMAÇÃO</p>
            <h2 id="resume-education-heading">Formação</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, education: [...draft.education, { id: createId(), institution: "", course: "", startDate: "", completionDate: "", status: "" }] })}>+ Adicionar formação</button>
        </div>
        {draft.education.map((education, index) => (
          <fieldset className="resume-entry" key={education.id}>
            <legend>Formação {index + 1}</legend>
            <div className="resume-field-grid">
              <TextField id={`education-institution-${education.id}`} label="Instituição" value={education.institution} maxLength={RESUME_FIELD_LIMITS.education.institution} onChange={(value) => updateEducation(education.id, { institution: value })} />
              <TextField id={`education-course-${education.id}`} label="Curso" value={education.course} maxLength={RESUME_FIELD_LIMITS.education.course} onChange={(value) => updateEducation(education.id, { course: value })} />
              <TextField id={`education-start-${education.id}`} label="Início" type="month" value={education.startDate} maxLength={RESUME_FIELD_LIMITS.education.startDate} onChange={(value) => updateEducation(education.id, { startDate: value })} />
              <TextField id={`education-completion-${education.id}`} label="Conclusão prevista/conclusão" type="month" value={education.completionDate} maxLength={RESUME_FIELD_LIMITS.education.completionDate} onChange={(value) => updateEducation(education.id, { completionDate: value })} />
              <TextField id={`education-status-${education.id}`} label="Status" value={education.status} maxLength={RESUME_FIELD_LIMITS.education.status} onChange={(value) => updateEducation(education.id, { status: value })} />
            </div>
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, education: removeResumeItem(draft.education, education.id) })}>Remover formação</button>
          </fieldset>
        ))}
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-projects-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">05 · PRÁTICA</p>
            <h2 id="resume-projects-heading">Projetos</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, projects: [...draft.projects, { id: createId(), name: "", description: "", technologies: "", link: "" }] })}>+ Adicionar projeto</button>
        </div>
        {draft.projects.map((project, index) => (
          <fieldset className="resume-entry" key={project.id}>
            <legend>Projeto {index + 1}</legend>
            <div className="resume-field-grid">
              <TextField id={`project-name-${project.id}`} label="Nome" value={project.name} maxLength={RESUME_FIELD_LIMITS.projects.name} onChange={(value) => updateProject(project.id, { name: value })} />
              <TextField id={`project-description-${project.id}`} label="Descrição" value={project.description} maxLength={RESUME_FIELD_LIMITS.projects.description} multiline onChange={(value) => updateProject(project.id, { description: value })} />
              <TextField id={`project-technologies-${project.id}`} label="Tecnologias" value={project.technologies} maxLength={RESUME_FIELD_LIMITS.projects.technologies} onChange={(value) => updateProject(project.id, { technologies: value })} />
              <TextField id={`project-link-${project.id}`} label="Link do projeto/repositório" type="url" value={project.link} maxLength={RESUME_FIELD_LIMITS.projects.link} onChange={(value) => updateProject(project.id, { link: value })} error={project.link && !isValidOptionalUrl(project.link) ? "Informe uma URL iniciada por http:// ou https://." : undefined} />
            </div>
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, projects: removeResumeItem(draft.projects, project.id) })}>Remover projeto</button>
          </fieldset>
        ))}
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-skills-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">06 · COMPETÊNCIAS</p>
            <h2 id="resume-skills-heading">Tecnologias e habilidades</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, skills: [...draft.skills, { id: createId(), name: "" }] })}>+ Adicionar habilidade</button>
        </div>
        {draft.skills.map((skill) => (
          <div className="resume-entry resume-entry-inline" key={skill.id}>
            <TextField id={`skill-name-${skill.id}`} label="Tecnologia ou habilidade" value={skill.name} maxLength={RESUME_FIELD_LIMITS.skills.name} onChange={(value) => updateSkill(skill.id, { name: value })} />
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, skills: removeResumeItem(draft.skills, skill.id) })}>Remover</button>
          </div>
        ))}
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-languages-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">07 · IDIOMAS</p>
            <h2 id="resume-languages-heading">Idiomas</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, languages: [...draft.languages, { id: createId(), name: "", proficiency: "" }] })}>+ Adicionar idioma</button>
        </div>
        {draft.languages.map((language) => (
          <div className="resume-entry resume-entry-inline" key={language.id}>
            <TextField id={`language-name-${language.id}`} label="Idioma" value={language.name} maxLength={RESUME_FIELD_LIMITS.languages.name} onChange={(value) => updateLanguage(language.id, { name: value })} />
            <TextField id={`language-proficiency-${language.id}`} label="Nível" value={language.proficiency} maxLength={RESUME_FIELD_LIMITS.languages.proficiency} onChange={(value) => updateLanguage(language.id, { proficiency: value })} />
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, languages: removeResumeItem(draft.languages, language.id) })}>Remover</button>
          </div>
        ))}
      </section>

      <section className="resume-editor-section" aria-labelledby="resume-certifications-heading">
        <div className="resume-editor-section-heading">
          <div>
            <p className="resume-section-eyebrow">08 · CREDENCIAIS</p>
            <h2 id="resume-certifications-heading">Certificações</h2>
          </div>
          <button className="resume-add-button" type="button" onClick={() => onChange({ ...draft, certifications: [...draft.certifications, { id: createId(), name: "", issuer: "", year: "", url: "" }] })}>+ Adicionar certificação</button>
        </div>
        {draft.certifications.map((certification) => (
          <fieldset className="resume-entry" key={certification.id}>
            <legend>Certificação</legend>
            <div className="resume-field-grid">
              <TextField id={`certification-name-${certification.id}`} label="Nome" value={certification.name} maxLength={RESUME_FIELD_LIMITS.certifications.name} onChange={(value) => updateCertification(certification.id, { name: value })} />
              <TextField id={`certification-issuer-${certification.id}`} label="Instituição/emissor" value={certification.issuer} maxLength={RESUME_FIELD_LIMITS.certifications.issuer} onChange={(value) => updateCertification(certification.id, { issuer: value })} />
              <TextField id={`certification-year-${certification.id}`} label="Ano" value={certification.year} maxLength={RESUME_FIELD_LIMITS.certifications.year} onChange={(value) => updateCertification(certification.id, { year: value })} />
              <TextField id={`certification-url-${certification.id}`} label="Link (opcional)" type="url" value={certification.url} maxLength={RESUME_FIELD_LIMITS.certifications.url} onChange={(value) => updateCertification(certification.id, { url: value })} error={certification.url && !isValidOptionalUrl(certification.url) ? "Informe uma URL iniciada por http:// ou https://." : undefined} />
            </div>
            <button className="resume-remove-button" type="button" onClick={() => onChange({ ...draft, certifications: removeResumeItem(draft.certifications, certification.id) })}>Remover certificação</button>
          </fieldset>
        ))}
      </section>
    </form>
  );
}
