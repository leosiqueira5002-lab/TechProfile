import { createEmptyResumeDraft } from "./model.ts";
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProjectEntry,
  ResumeDraft,
  SkillEntry,
} from "./types.ts";

type EvidenceItem = { evidence: string[] };
type TransferAnalysis = {
  education: Array<{ name: string; institution: string | null; period: string | null; evidence: string[] }>;
  projects: Array<{ name: string | null; description: string; technologies: string[]; evidence: string[] }>;
  experiences: Array<{ company: string | null; role: string | null; period: string | null; summary: string; evidence: string[] }>;
  technologies: Array<{ name: string; evidence: string[] }>;
  certifications: Array<{ name: string; issuer: string | null; period: string | null; evidence: string[] }>;
};

type ResumeTransferInput = { extractedText: string; role: string; analysis: TransferAnalysis };

const educationCue = /engenharia|ci[eê]ncia|sistemas?|gradua[cç][ãa]o|bacharelado|licenciatura|tecn[oó]logo|curso|forma[cç][ãa]o|software engineering|computer science|information systems|degree/i;
const projectCue = /\b(?:projeto|project|aplica[cç][ãa]o|aplicativo|application|sistema|system|plataforma|platform|site|reposit[oó]rio|repository|desenvolv(?:i|id)[oa]|developed)\b/i;
const projectOnlyLink = /^\s*(?:(?:link|url)\s+(?:do\s+)?)?(?:reposit[oó]rio|github|projeto)?\s*:?\s*(?:https?:\/\/|www\.|github\.com\/)[^\s]*\s*$/i;
const projectLinkLabel = /^\s*(?:link\s+(?:do\s+)?)?(?:reposit[oó]rio|github|url)\s*[:\-]/i;
const projectLinkReference = /^\s*(?:(?:link|url)\s+(?:do\s+)?)?(?:reposit[oó]rio|repository|github|url)\s*[:\-]?\s*$/i;
const projectHeaderOnly = /^\s*(?:projetos?|lista projetos?)\s*[:\-]?\s*$/i;
const experienceCue = /\b(?:trabalh(?:ei|ou|o)|atuei|atuou|est[aá]gio|estagi[aá]ri[oa]|freelancer|freelance|contratad[oa]|empregad[oa]|experi[eê]ncia profissional|worked|work experience|internship|freelancer|employed)\b/i;
const professionalRole = /\b(?:desenvolvedor[\w]*|engenheir[\w]*|analista|programador[\w]*|arquiteto[\w]*|administrador[\w]*|t[eé]cnic[oa]|consultor[\w]*|designer|gerente|coordenador[\w]*|especialista|developer|engineer|analyst|programmer|architect|technician|consultant|manager|specialist)\b/i;
const languages = ["Portugu[eê]s", "Ingl[eê]s", "Espanhol", "Franc[eê]s", "Alem[aã]o", "Italiano", "Mandarim", "Japon[eê]s", "Libras", "Portuguese", "English", "Spanish", "French", "German", "Italian", "Mandarin", "Japanese"];
const levels = ["b[aá]sic[oa]", "intermedi[aá]ri[oa]", "avan[cç]ad[oa]", "fluente", "nativ[oa]", "basic", "intermediate", "advanced", "fluent", "native", "A1", "A2", "B1", "B2", "C1", "C2"];

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function hasSourceEvidence(value: string, source: string): boolean {
  return Boolean(value.trim()) && normalized(source).includes(normalized(value));
}

function uniqueId(): string {
  return crypto.randomUUID();
}

function sourceLines(source: string): string[] {
  return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function exactEvidence<T extends EvidenceItem>(items: T[], source: string): T[] {
  return items.map((item) => ({ ...item, evidence: item.evidence.filter((line) => hasSourceEvidence(line, source)) }))
    .filter((item) => item.evidence.length > 0);
}

export function extractResumePersonalInfo(source: string): ResumeDraft["personalInfo"] {
  const lines = sourceLines(source);
  const email = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.exec(source)?.[0] ?? "";
  const labeledName = lines.map((line) => /^\s*(?:nome|name)\s*[:\-]\s*(.+)$/i.exec(line)?.[1]?.trim()).find(Boolean);
  const firstCandidate = lines.find((line) => /^[\p{L}'’-]+(?:\s+[\p{L}'’-]+){1,4}$/u.test(line) && !isHeading(line));
  const name = labeledName ?? firstCandidate ?? "";

  const locationLine = lines.find((line) => /^(?:cidade(?:\s*\/\s*estado)?|localiza[cç][ãa]o|city(?:\s*\/\s*state)?|location)\s*[:\-]/i.test(line));
  const locationValue = locationLine?.replace(/^(?:cidade(?:\s*\/\s*estado)?|localiza[cç][ãa]o|city(?:\s*\/\s*state)?|location)\s*[:\-]\s*/i, "").trim() ?? "";
  const cityState = /^(?!.*\b(?:rua|avenida|av\.|travessa|rodovia|cep|n[úu]mero)\b).+[,/\-]\s*[A-Z]{2}$/i.test(locationValue)
    ? locationValue
    : "";

  const phoneLine = lines.find((line) => /^(?:telefone|celular|phone|mobile)\s*[:\-]/i.test(line));
  const phone = phoneLine?.replace(/^(?:telefone|celular|phone|mobile)\s*[:\-]\s*/i, "").trim() ?? "";
  const linkedin = extractUrl(source, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s),;]+/i);
  const github = extractUrl(source, /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s),;]+/i);
  const portfolioLine = lines.find((line) => /^portf[oó]lio\s*[:\-]/i.test(line));
  const portfolio = portfolioLine ? extractUrl(portfolioLine, /(?:https?:\/\/)?(?:www\.)?[^\s),;]+\.[a-z]{2,}(?:\/[^\s),;]*)?/i) : "";

  return {
    fullName: name,
    cityState,
    email,
    phone,
    linkedinUrl: linkedin,
    githubPortfolioUrl: github || portfolio,
  };
}

function extractUrl(source: string, pattern: RegExp): string {
  const match = pattern.exec(source)?.[0]?.replace(/[.,;]+$/, "") ?? "";
  if (!match) return "";
  const withProtocol = /^https?:\/\//i.test(match) ? match : `https://${match}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.includes(".") ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function isHeading(line: string): boolean {
  return /^(?:curr[ií]culo|curriculum vitae|resumo(?: profissional)?|professional summary|summary|perfil(?: profissional)?|experi[eê]ncia(?: profissional)?|professional experience|work experience|experience|forma[cç][ãa]o(?: acad[eê]mica)?|educa[cç][ãa]o|education|projetos?|projects?|habilidades|compet[eê]ncias|skills|certifica[cç][õo]es?|certifications?|idiomas|languages?|contato|contact|objetivo profissional)$/i.test(line.trim());
}

function mapEducation(items: TransferAnalysis["education"], source: string): EducationEntry[] {
  return exactEvidence(items, source).flatMap((item) => {
    const line = item.evidence.find((candidate) => educationCue.test(candidate)) ?? item.name;
    if (!hasSourceEvidence(line, source) || !educationCue.test(line)) return [];
    const facts = item.evidence.join("\n");

    const labeledCourse = /(?:curso|forma[cç][ãa]o)\s*[:\-]\s*([^.;|]+)/i.exec(facts)?.[1];
    const institution = /\b(?:na|no|em|institui[cç][ãa]o\s*[:\-]?)\s+((?:universidade|university|faculdade|college|instituto|institute|centro universit[aá]rio|escola)\b[^\n,.;|—–]*)/i.exec(facts)?.[1]
      ?? /\b((?:universidade|university|faculdade|college|instituto|institute|centro universit[aá]rio)\s+[\p{L}\d][^\n,.;|—–]*)/iu.exec(facts)?.[1]
      ?? (item.institution && hasSourceEvidence(item.institution, facts) ? item.institution : "");
    const institutionIndex = institution ? line.toLocaleLowerCase().indexOf(institution.toLocaleLowerCase()) : -1;
    const beforeInstitution = institutionIndex >= 0 ? line.slice(0, institutionIndex).trim() : line;
    const firstPart = beforeInstitution.split(/[|—–;]/)[0].replace(/^(?:forma[cç][ãa]o(?: acad[eê]mica)?|educa[cç][ãa]o)\s*[:\-]?\s*/i, "").trim();
    const course = (labeledCourse ?? firstPart).replace(/\s*,?\s*(?:cursando|em andamento|conclu[ií]d[oa]|trancad[oa]).*$/i, "").replace(/\s*,?\s*\d{1,2}[º°]?\s*(?:per[ií]odo|semestre).*$/i, "").replace(/\s*,?\s*\d{4}\s*(?:[-–—]|a)\s*\d{4}.*$/i, "").replace(/\s*,\s*(?:19|20)\d{2}.*$/, "").replace(/[\s\-—–|]+$/, "").trim();
    const dateRange = /\b((?:19|20)\d{2})\s*(?:[-–—]|\ba\b|\bat[eé]\b)\s*((?:19|20)\d{2})\b/i.exec(facts);
    const startDate = dateRange ? dateRange[1] : extractLabeledYear(facts, /(?:in[ií]cio|iniciado)\s*[:\-]?\s*((?:19|20)\d{2})/i);
    const completionDate = dateRange ? dateRange[2] : extractLabeledYear(facts, /(?:conclus[aã]o(?:\s+prevista)?|t[eé]rmino|previs[aã]o)\s*[:\-]?\s*((?:19|20)\d{2})/i);
    const status = /\b(?:cursando|em andamento|conclu[ií]d[oa]|trancad[oa]|in progress|completed|graduated)\b/i.exec(facts)?.[0] ?? "";

    return [{ id: uniqueId(), institution: institution.trim(), course, startDate, completionDate, status }];
  });
}

function extractLabeledYear(source: string, pattern: RegExp): string {
  return pattern.exec(source)?.[1] ?? "";
}

function mapProjects(items: TransferAnalysis["projects"], technologies: TransferAnalysis["technologies"], source: string): ProjectEntry[] {
  return exactEvidence(items, source).flatMap((item) => {
    const lines = item.evidence.filter((line) => !projectLinkLabel.test(line) && !projectLinkReference.test(line) && !projectOnlyLink.test(line) && !projectHeaderOnly.test(line));
    if (!lines.length) return [];
    const evidence = lines.find((line) => projectCue.test(line));
    if (!evidence) return [];
    const explicitNameLine = /^(?:(?:lista\s+)?projeto(?:\s+pessoal|\s+acad[eê]mico|\s+publicado)?|project(?:\s+(?:personal|academic))?)\s*[:\-]\s*(.+)$/i.exec(evidence)?.[1];
    const explicitName = explicitNameLine?.split(/\s+[—–-]\s+|\s*\|\s*|\s*:\s*|\./)[0]?.trim();
    const candidateName = explicitName ?? (item.name && hasSourceEvidence(item.name, item.evidence.join(" ")) ? item.name.trim() : "");
    const name = candidateName && !projectHeaderOnly.test(candidateName) && !projectLinkLabel.test(candidateName) ? candidateName : "";
    let description = evidence;
    if (explicitName && evidence.includes(explicitName)) {
      description = evidence.slice(evidence.indexOf(explicitName) + explicitName.length).replace(/^\s*(?:[—–-]|\||:)\s*/, "").trim();
    } else if (name && evidence.startsWith(name)) {
      description = evidence.slice(name.length).replace(/^\s*(?:[—–-]|\||:)\s*/, "").trim();
    }
    const projectFacts = item.evidence.join(" ");
    const explicitTechs = technologies.filter((tech) => tech.evidence.some((line) => hasSourceEvidence(line, source) && hasSourceEvidence(tech.name, projectFacts)))
      .map((tech) => tech.name);
    return [{ id: uniqueId(), name, description, technologies: [...new Set(explicitTechs)].join(", "), link: extractUrl(projectFacts, /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com)\/[^\s),;]+/i) }];
  });
}

function mapExperiences(items: TransferAnalysis["experiences"], source: string): ExperienceEntry[] {
  return exactEvidence(items, source).flatMap((item) => {
    const line = item.evidence.find((candidate) => !/\b(?:projeto|projects?|acad[eê]mico|pessoal|universit[aá]rio)\b/i.test(candidate) && isProfessionalEvidence(candidate));
    if (!line) return [];
    const facts = item.evidence.join("\n");
    const position = /\b(?:cargo|fun[cç][ãa]o|role|position)\s*[:\-]\s*([^\n,.;]+)/i.exec(facts)?.[1]?.trim()
      ?? /(?:trabalh(?:ei|ou)|atuei|atuou|worked)\s+(?:as\s+|como\s+)?([^,.;]+?)(?=\s+(?:na|no|em|pela|para|at|for)\s|[,.;]|$)/i.exec(line)?.[1]
      ?? /\b((?:desenvolvedor[\w]*|engenheir[\w]*|analista|programador[\w]*|arquiteto[\w]*|t[eé]cnic[oa]|consultor[\w]*|designer|gerente|coordenador[\w]*|especialista|developer|engineer|analyst|programmer|architect|technician|consultant|manager|specialist)[^,.;]*?)(?=\s+(?:na|no|em|at|for)\s|[,.;]|$)/i.exec(line)?.[1]
      ?? (item.role && hasSourceEvidence(item.role, facts) ? item.role : "");
    const company = /\b(?:empresa|employer|company)\s*[:\-]\s*([^\n,.;]+)/i.exec(facts)?.[1]?.trim()
      ?? /\b(?:na|no|pela|pelo|at|for)\s+([\p{L}\d][\p{L}\d &.'’-]*?)(?=\s*,|\s+(?:de|desde|entre|from|since)\s|[.;]|$)/iu.exec(line)?.[1]
      ?? (item.company && hasSourceEvidence(item.company, facts) ? item.company : "");
    const range = extractMonthDateRange(facts);
    const description = item.evidence.filter((entry) => !/^(?:cargo|fun[cç][ãa]o|role|position|empresa|employer|company|per[ií]odo|period)\s*[:\-]/i.test(entry) && !isHeading(entry)).join(" ");
    return [{
      id: uniqueId(), company: hasSourceEvidence(company, facts) ? company.trim() : "", position: hasSourceEvidence(position, facts) ? position.trim() : "",
      startDate: range.start, endDate: range.end, isCurrent: /\b(?:atualmente|atual|presente|current|present)\b/i.test(facts), description,
    }];
  });
}

function isProfessionalEvidence(line: string): boolean {
  if (isHeading(line.replace(/[:\-\s]+$/, ""))) return false;
  return experienceCue.test(line) || (professionalRole.test(line) && /\b(?:na|no|pela|pelo|empresa)\s+[\p{L}\d]/iu.test(line)) || /\b(?:empresa|cargo|fun[cç][ãa]o)\s*[:\-]\s*\S/i.test(line);
}

function extractMonthDateRange(source: string): { start: string; end: string } {
  const match = /(\d{1,2}[/-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2})\s*(?:[-–—]|\ba\b|\bat[eé]\b)\s*(\d{1,2}[/-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2})/i.exec(source);
  if (match) {
    const toIsoMonth = (value: string) => value.includes("-") && /^\d{4}-\d{2}$/.test(value)
      ? value
      : `${value.split(/[/-]/)[1]}-${value.split(/[/-]/)[0].padStart(2, "0")}`;
    return { start: toIsoMonth(match[1]), end: toIsoMonth(match[2]) };
  }
  const yearRange = /\b((?:19|20)\d{2})\s*(?:[-–—]|\ba\b|\bat[eé]\b)\s*((?:19|20)\d{2})\b/i.exec(source);
  if (yearRange) return { start: yearRange[1], end: yearRange[2] };
  const startYear = /\b(?:desde|in[ií]cio\s*[:\-]?)\s*((?:19|20)\d{2})\b/i.exec(source)?.[1] ?? "";
  return { start: startYear, end: "" };
}

function mapLanguages(source: string): LanguageEntry[] {
  const results: LanguageEntry[] = [];
  const languagePattern = new RegExp(`\\b(${languages.join("|")})\\b`, "giu");
  const levelPattern = new RegExp(`\\b(${levels.join("|")})\\b`, "iu");
  for (const line of sourceLines(source)) {
    for (const segment of line.split(/[;,|]/)) {
      const language = languagePattern.exec(segment)?.[1];
      languagePattern.lastIndex = 0;
      const proficiency = levelPattern.exec(segment)?.[1] ?? "";
      if (language && proficiency) results.push({ id: uniqueId(), name: language, proficiency });
    }
  }
  return results;
}

function mapCertifications(items: TransferAnalysis["certifications"], source: string): CertificationEntry[] {
  return exactEvidence(items, source).flatMap((item) => {
    const line = item.evidence.find((candidate) => /certifica[cç][ãa]o|license|certified|certifica[td]/i.test(candidate));
    if (!line) return [];
    const name = hasSourceEvidence(item.name, line) ? item.name : line.replace(/^certifica[cç][ãa]o\s*[:\-]\s*/i, "");
    const issuer = item.issuer && hasSourceEvidence(item.issuer, line) ? item.issuer : /\b(?:por|emissor)\s*[:\-]?\s*([^,.;]+)/i.exec(line)?.[1]?.trim() ?? "";
    const year = /\b((?:19|20)\d{2})\b/.exec(line)?.[1] ?? "";
    return [{ id: uniqueId(), name, issuer, year, url: extractUrl(line, /(?:https?:\/\/)?(?:www\.)?[^\s),;]+\.[a-z]{2,}(?:\/[^\s),;]*)?/i) }];
  });
}

function mapSkills(items: TransferAnalysis["technologies"], source: string): SkillEntry[] {
  return items.filter((item) => hasSourceEvidence(item.name, source) && item.evidence.some((line) => hasSourceEvidence(line, source) && hasSourceEvidence(item.name, line)))
    .map((item) => ({ id: uniqueId(), name: item.name }));
}

function mapSummary(source: string): string {
  const lines = sourceLines(source);
  const headingIndex = lines.findIndex((line) => /^(?:resumo(?:\s+profissional)?|perfil(?:\s+profissional)?|professional\s+summary|summary)$/i.test(line));
  if (headingIndex < 0) return "";
  const content = lines.slice(headingIndex + 1);
  const nextHeading = content.findIndex(isHeading);
  return content.slice(0, nextHeading < 0 ? content.length : nextHeading).join(" ").trim();
}

export function mapResumeToDraft({ extractedText, role, analysis }: ResumeTransferInput): ResumeDraft {
  const draft = createEmptyResumeDraft();
  const source = extractedText.normalize("NFC");
  draft.personalInfo = extractResumePersonalInfo(source);
  draft.desiredRole = role.trim();
  draft.summary = mapSummary(source);
  draft.education = mapEducation(analysis.education, source);
  draft.projects = mapProjects(analysis.projects, analysis.technologies, source);
  draft.experiences = mapExperiences(analysis.experiences, source);
  draft.skills = mapSkills(analysis.technologies, source);
  draft.languages = mapLanguages(source);
  draft.certifications = mapCertifications(analysis.certifications, source);
  return draft;
}
