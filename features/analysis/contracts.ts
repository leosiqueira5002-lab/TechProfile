import { z } from "zod";
import { MAX_EXTRACTED_CHARACTERS } from "../documents/limits.ts";
import { PROFESSIONAL_AREAS } from "./areas.ts";

export const AnalysisInputSchema = z.object({
  extractedText: z.string().trim().min(1).max(MAX_EXTRACTED_CHARACTERS),
  area: z.enum(PROFESSIONAL_AREAS),
  role: z.string().trim().min(2).max(120),
  analysisConfirmed: z.literal(true),
}).strict();

const EvidenceText = z.array(z.string().trim().min(1).max(500)).max(8);
const FactualObservation = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(700),
  evidence: EvidenceText,
}).strict();

export const AnalysisResultSchema = z.object({
  summary: z.object({ text: z.string().trim().min(1).max(900), evidence: EvidenceText }).strict(),
  strengths: z.array(FactualObservation).max(8),
  improvements: z.array(FactualObservation).max(8),
  technologies: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    context: z.string().trim().min(1).max(400),
    evidence: EvidenceText,
  }).strict()).max(30),
  experiences: z.array(z.object({
    company: z.string().max(160).nullable(),
    role: z.string().max(160).nullable(),
    period: z.string().max(100).nullable(),
    summary: z.string().trim().min(1).max(600),
    evidence: EvidenceText,
  }).strict()).max(20),
  projects: z.array(z.object({
    name: z.string().max(160).nullable(),
    description: z.string().trim().min(1).max(500),
    technologies: z.array(z.string().trim().min(1).max(100)).max(20),
    evidence: EvidenceText,
  }).strict()).max(20),
  education: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    institution: z.string().max(200).nullable(),
    period: z.string().max(100).nullable(),
    evidence: EvidenceText,
  }).strict()).max(20),
  certifications: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().max(200).nullable(),
    period: z.string().max(100).nullable(),
    evidence: EvidenceText,
  }).strict()).max(20),
  categories: z.object({
    experience: categorySchema(),
    technologies: categorySchema(),
    projects: categorySchema(),
    clarity: categorySchema(),
    positioning: categorySchema(),
  }).strict(),
  recommendations: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(600),
    evidence: EvidenceText,
  }).strict()).max(8),
}).strict();

function categorySchema() {
  return z.object({
    status: z.enum(["good", "needs_attention", "not_mentioned", "unclear"]),
    explanation: z.string().trim().min(1).max(400),
    evidence: EvidenceText,
  }).strict();
}

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export function validateAnalysisInput(value: unknown) {
  return AnalysisInputSchema.safeParse(value);
}

export function redactResumeText(input: string): string {
  const normalized = input.normalize("NFC");
  const lines = normalized.split(/\r?\n/).map((line) => /^(?:endereço|address|localização|location)\s*[:\-]/i.test(line) ? "[ENDEREÇO REMOVIDO]" : line);
  if (lines.length > 0 && looksLikePersonalName(lines[0])) lines[0] = "[NOME REMOVIDO]";
  return lines.join("\n")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL REMOVIDO]")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[LINK REMOVIDO]")
    .replace(/\b(?:linkedin\.com\/in\/|github\.com\/)[^\s]+/gi, "[LINK REMOVIDO]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[IDENTIFICADOR REMOVIDO]")
    .replace(/(?:telefone|celular|phone|mobile)\s*[:\-][^\n]*/gi, "[TELEFONE REMOVIDO]")
    .replace(/(?:\+?55[ .()-]*)?\(?\d{2}\)?[ .-]*(?:9\d{4}|[2-8]\d{3})[ .-]?\d{4}\b/g, "[TELEFONE REMOVIDO]");
}

function looksLikePersonalName(value: string): boolean {
  const line = value.trim();
  if (line.length < 4 || line.length > 90 || /[@:/\d|]/.test(line)) return false;
  const words = line.split(/\s+/);
  return words.length >= 2 && words.length <= 5 && words.every((word) => /^[\p{L}'’-]+$/u.test(word));
}

function normalizeEvidence(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

export function validateEvidence(value: unknown, source: string) {
  const parsed = AnalysisResultSchema.safeParse(value);
  if (!parsed.success) return { success: false as const, reason: "schema" };

  const normalizedSource = normalizeEvidence(source);
  const hasEvidence = (items: string[]) => items.length > 0 && items.every((item) => normalizedSource.includes(normalizeEvidence(item)));
  const result = parsed.data;

  if (!hasEvidence(result.summary.evidence)) return { success: false as const, reason: "summary_evidence" };
  const evidenceCollections = [
    ...result.strengths,
    ...result.technologies,
    ...result.experiences,
    ...result.projects,
    ...result.education,
    ...result.certifications,
  ];
  if (evidenceCollections.some((item) => !hasEvidence(item.evidence))) return { success: false as const, reason: "fact_evidence" };
  if (result.improvements.some((item) => !hasEvidence(item.evidence) && !isConditionalSuggestion(item.description))) return { success: false as const, reason: "improvement_evidence" };
  if (Object.values(result.categories).some((item) => item.status !== "not_mentioned" && item.status !== "unclear" && !hasEvidence(item.evidence))) {
    return { success: false as const, reason: "category_evidence" };
  }
  if (result.recommendations.some((item) => !hasEvidence(item.evidence) && !isConditionalSuggestion(item.description))) return { success: false as const, reason: "recommendation_evidence" };
  const sourceHas = (fact: string) => normalizedSource.includes(normalizeEvidence(fact));
  if (result.technologies.some((item) => !sourceHas(item.name))) return { success: false as const, reason: "technology_not_found" };
  if (result.experiences.some((item) => [item.company, item.role, item.period].some((fact) => fact !== null && !sourceHas(fact)))) return { success: false as const, reason: "experience_detail_not_found" };
  if (result.projects.some((item) => (item.name !== null && !sourceHas(item.name)) || item.technologies.some((technology) => !sourceHas(technology)))) return { success: false as const, reason: "project_detail_not_found" };
  if (result.education.some((item) => [item.name, item.institution, item.period].some((fact) => fact !== null && !sourceHas(fact)))) return { success: false as const, reason: "education_detail_not_found" };
  if (result.certifications.some((item) => [item.name, item.issuer, item.period].some((fact) => fact !== null && !sourceHas(fact)))) return { success: false as const, reason: "certification_detail_not_found" };
  return { success: true as const, data: result };
}

function isConditionalSuggestion(value: string): boolean {
  return /^(?:se|caso)\b/i.test(value.trim());
}

export const ANALYSIS_JSON_SCHEMA = z.toJSONSchema(AnalysisResultSchema, { target: "draft-7" });
