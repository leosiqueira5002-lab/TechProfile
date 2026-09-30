import { z } from "zod";
import { PROFESSIONAL_AREAS } from "../analysis/areas.ts";
import { redactResumeText } from "../analysis/contracts.ts";
import { MAX_EXTRACTED_CHARACTERS } from "../documents/limits.ts";
import { createEmptyResumeDraft, RESUME_FIELD_LIMITS } from "./model.ts";
import { extractResumePersonalInfo } from "./transfer.ts";
import type { ResumeDraft } from "./types.ts";

const UsefulResumeText = z.string().max(MAX_EXTRACTED_CHARACTERS).refine((text) => text.trim().length >= 100, "Insufficient resume text");
const RequiredEvidence = z.array(z.string().trim().min(1).max(500)).min(1).max(8);
const OptionalText = (max: number) => z.string().trim().max(max);

export const OptimizeResumeInputSchema = z.object({
  extractedText: UsefulResumeText,
  area: z.enum(PROFESSIONAL_AREAS),
  role: z.string().trim().min(2).max(RESUME_FIELD_LIMITS.desiredRole),
}).strict();

const CandidateExperience = z.object({
  company: OptionalText(RESUME_FIELD_LIMITS.experiences.company),
  position: OptionalText(RESUME_FIELD_LIMITS.experiences.position),
  startDate: OptionalText(RESUME_FIELD_LIMITS.experiences.startDate),
  endDate: OptionalText(RESUME_FIELD_LIMITS.experiences.endDate),
  isCurrent: z.boolean(),
  description: OptionalText(RESUME_FIELD_LIMITS.experiences.description),
  sourceEvidence: RequiredEvidence,
}).strict();

const CandidateEducation = z.object({
  institution: OptionalText(RESUME_FIELD_LIMITS.education.institution),
  course: OptionalText(RESUME_FIELD_LIMITS.education.course),
  startDate: OptionalText(RESUME_FIELD_LIMITS.education.startDate),
  completionDate: OptionalText(RESUME_FIELD_LIMITS.education.completionDate),
  status: OptionalText(RESUME_FIELD_LIMITS.education.status),
  sourceEvidence: RequiredEvidence,
}).strict();

const CandidateProject = z.object({
  name: OptionalText(RESUME_FIELD_LIMITS.projects.name),
  description: OptionalText(RESUME_FIELD_LIMITS.projects.description),
  technologies: OptionalText(RESUME_FIELD_LIMITS.projects.technologies),
  link: OptionalText(RESUME_FIELD_LIMITS.projects.link),
  sourceEvidence: RequiredEvidence,
}).strict();

const CandidateSkill = z.object({ name: OptionalText(RESUME_FIELD_LIMITS.skills.name), sourceEvidence: RequiredEvidence }).strict();
const CandidateLanguage = z.object({
  name: OptionalText(RESUME_FIELD_LIMITS.languages.name),
  proficiency: OptionalText(RESUME_FIELD_LIMITS.languages.proficiency),
  sourceEvidence: RequiredEvidence,
}).strict();
const CandidateCertification = z.object({
  name: OptionalText(RESUME_FIELD_LIMITS.certifications.name),
  issuer: OptionalText(RESUME_FIELD_LIMITS.certifications.issuer),
  year: OptionalText(RESUME_FIELD_LIMITS.certifications.year),
  url: OptionalText(RESUME_FIELD_LIMITS.certifications.url),
  sourceEvidence: RequiredEvidence,
}).strict();

export const GeminiResumeCandidateSchema = z.object({
  summary: OptionalText(RESUME_FIELD_LIMITS.summary),
  summaryEvidence: RequiredEvidence,
  experiences: z.array(CandidateExperience).max(20),
  education: z.array(CandidateEducation).max(20),
  projects: z.array(CandidateProject).max(20),
  skills: z.array(CandidateSkill).max(50),
  languages: z.array(CandidateLanguage).max(20),
  certifications: z.array(CandidateCertification).max(20),
}).strict();

const DraftExperience = CandidateExperience.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();
const DraftEducation = CandidateEducation.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();
const DraftProject = CandidateProject.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();
const DraftSkill = CandidateSkill.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();
const DraftLanguage = CandidateLanguage.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();
const DraftCertification = CandidateCertification.omit({ sourceEvidence: true }).extend({ id: z.string().min(1) }).strict();

export const ResumeDraftSchema = z.object({
  personalInfo: z.object({
    fullName: OptionalText(RESUME_FIELD_LIMITS.personalInfo.fullName),
    cityState: OptionalText(RESUME_FIELD_LIMITS.personalInfo.cityState),
    email: OptionalText(RESUME_FIELD_LIMITS.personalInfo.email),
    phone: OptionalText(RESUME_FIELD_LIMITS.personalInfo.phone),
    linkedinUrl: OptionalText(RESUME_FIELD_LIMITS.personalInfo.linkedinUrl),
    githubPortfolioUrl: OptionalText(RESUME_FIELD_LIMITS.personalInfo.githubPortfolioUrl),
  }).strict(),
  desiredRole: OptionalText(RESUME_FIELD_LIMITS.desiredRole),
  summary: OptionalText(RESUME_FIELD_LIMITS.summary),
  experiences: z.array(DraftExperience).max(20),
  education: z.array(DraftEducation).max(20),
  projects: z.array(DraftProject).max(20),
  skills: z.array(DraftSkill).max(50),
  languages: z.array(DraftLanguage).max(20),
  certifications: z.array(DraftCertification).max(20),
}).strict();

export type GeminiResumeCandidate = z.infer<typeof GeminiResumeCandidateSchema>;
export const GEMINI_RESUME_RESPONSE_SCHEMA = z.toJSONSchema(GeminiResumeCandidateSchema, { target: "draft-7" });

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function appearsIn(value: string, source: string): boolean {
  return normalize(source).includes(normalize(value));
}

function factualValuesAreSupported(values: string[], source: string): boolean {
  return values.filter(Boolean).every((value) => appearsIn(value, source));
}

function generatedTextHasUnsupportedAnchors(value: string, evidence: string[]): boolean {
  const source = evidence.join(" ");
  const numericClaims = value.match(/\b(?:19|20)\d{2}\b|\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
  const namedClaims = value.match(/\b(?:\p{Lu}[\p{L}\d+#.-]*|[A-Z]{2,})\b/gu) ?? [];
  return !factualValuesAreSupported([...numericClaims, ...namedClaims], source);
}

function isProfessionalEvidence(evidence: string[]): boolean {
  const joined = evidence.join(" ");
  if (/\b(?:projeto|project|acad[eê]mic[oa]|pessoal|universit[aá]ri[oa])\b/i.test(joined)) return false;
  return /\b(?:trabalh(?:ei|ou|o)|atuei|est[aá]gio|estagi[aá]ri[oa]|freelance|experi[eê]ncia profissional|worked|employment|internship|employed)\b/i.test(joined)
    || /\b(?:empresa|employer|company)\s*[:\-]/i.test(joined);
}

export function validateGeminiResumeCandidate(value: unknown, redactedSource: string) {
  const parsed = GeminiResumeCandidateSchema.safeParse(value);
  if (!parsed.success) return { success: false as const, reason: "schema" };
  const candidate = parsed.data;
  const evidenceSets = [candidate.summaryEvidence, ...candidate.experiences.map((item) => item.sourceEvidence),
    ...candidate.education.map((item) => item.sourceEvidence), ...candidate.projects.map((item) => item.sourceEvidence),
    ...candidate.skills.map((item) => item.sourceEvidence), ...candidate.languages.map((item) => item.sourceEvidence),
    ...candidate.certifications.map((item) => item.sourceEvidence)];
  if (!evidenceSets.every((evidence) => evidence.every((quote) => appearsIn(quote, redactedSource)))) return { success: false as const, reason: "evidence" };
  if (generatedTextHasUnsupportedAnchors(candidate.summary, candidate.summaryEvidence)) return { success: false as const, reason: "summary_fact" };

  for (const item of candidate.experiences) {
    const sourceEvidence = item.sourceEvidence.join(" ");
    if (!isProfessionalEvidence(item.sourceEvidence)) return { success: false as const, reason: "experience_type" };
    if (!factualValuesAreSupported([item.company, item.position, item.startDate, item.endDate], sourceEvidence)) return { success: false as const, reason: "experience_fact" };
    if (generatedTextHasUnsupportedAnchors(item.description, item.sourceEvidence)) return { success: false as const, reason: "experience_description" };
    if (item.isCurrent && !/\b(?:atualmente|atual|presente|current|present)\b/i.test(sourceEvidence)) return { success: false as const, reason: "experience_current" };
  }
  for (const item of candidate.education) {
    if (!factualValuesAreSupported([item.institution, item.course, item.startDate, item.completionDate, item.status], item.sourceEvidence.join(" "))) return { success: false as const, reason: "education_fact" };
    if (generatedTextHasUnsupportedAnchors(`${item.institution} ${item.course} ${item.status}`, item.sourceEvidence)) return { success: false as const, reason: "education_description" };
  }
  for (const item of candidate.projects) {
    const sourceEvidence = item.sourceEvidence.join(" ");
    if (!factualValuesAreSupported([item.name, item.description, item.link], sourceEvidence)) return { success: false as const, reason: "project_fact" };
    if (generatedTextHasUnsupportedAnchors(item.description, item.sourceEvidence)) return { success: false as const, reason: "project_description" };
    const technologies = item.technologies.split(/[,;|]/).map((part) => part.trim()).filter(Boolean);
    if (!factualValuesAreSupported(technologies, sourceEvidence)) return { success: false as const, reason: "project_technology" };
    if (item.link && !/https?:\/\//i.test(item.link)) return { success: false as const, reason: "project_link" };
  }
  if (candidate.skills.some((item) => !item.name || !factualValuesAreSupported([item.name], item.sourceEvidence.join(" ")))) return { success: false as const, reason: "skill_fact" };
  if (candidate.languages.some((item) => !factualValuesAreSupported([item.name, item.proficiency], item.sourceEvidence.join(" ")))) return { success: false as const, reason: "language_fact" };
  if (candidate.certifications.some((item) => !factualValuesAreSupported([item.name, item.issuer, item.year, item.url], item.sourceEvidence.join(" ")))) return { success: false as const, reason: "certification_fact" };
  return { success: true as const, data: candidate };
}

function withoutEvidence<T extends { sourceEvidence: string[] }>(item: T): Omit<T, "sourceEvidence"> {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== "sourceEvidence")) as Omit<T, "sourceEvidence">;
}

export function buildOptimizedResumeDraft(candidate: GeminiResumeCandidate, originalSource: string, role: string): ResumeDraft {
  const draft = createEmptyResumeDraft();
  draft.personalInfo = extractResumePersonalInfo(originalSource);
  draft.desiredRole = role.trim();
  draft.summary = candidate.summary;
  draft.experiences = candidate.experiences.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  draft.education = candidate.education.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  draft.projects = candidate.projects.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  draft.skills = candidate.skills.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  draft.languages = candidate.languages.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  draft.certifications = candidate.certifications.map((item) => ({ ...withoutEvidence(item), id: crypto.randomUUID() }));
  return draft;
}

export function redactResumeForOptimization(source: string): string {
  const labeledIdentifiersRemoved = source.replace(/^(?:nome|name)\s*[:\-][^\r\n]*/gim, "[NOME REMOVIDO]")
    .replace(/^(?:cidade(?:\s*\/\s*estado)?|city(?:\s*\/\s*state)?|localiza[cç][ãa]o|location)\s*[:\-][^\r\n]*/gim, "[LOCALIZAÇÃO REMOVIDA]");
  return redactResumeText(labeledIdentifiersRemoved);
}
