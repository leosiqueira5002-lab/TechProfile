import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  OptimizeResumeInputSchema,
  GeminiResumeCandidateSchema,
  buildOptimizedResumeDraft,
  redactResumeForOptimization,
  validateGeminiResumeCandidate,
} from "../features/resume/optimization-contract.ts";

const source = `Ana Silva\nEmail: ana@example.com\nCidade/Estado: São Paulo/SP\nCargo: Desenvolvedora Full Stack\nTrabalhei como Desenvolvedora na Acme de 2021 a 2024.\nProjeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript.\nFormação: Ciência da Computação na Universidade Federal de São Paulo.\nIdiomas: Inglês intermediário.`;

const validCandidate = {
  summary: "Desenvolvedora Full Stack com experiência na Acme.",
  summaryEvidence: ["Trabalhei como Desenvolvedora na Acme de 2021 a 2024."],
  experiences: [{ company: "Acme", position: "Desenvolvedora", startDate: "2021", endDate: "2024", isCurrent: false, description: "Trabalhei como Desenvolvedora na Acme de 2021 a 2024.", sourceEvidence: ["Trabalhei como Desenvolvedora na Acme de 2021 a 2024."] }],
  education: [{ institution: "Universidade Federal de São Paulo", course: "Ciência da Computação", startDate: "", completionDate: "", status: "", sourceEvidence: ["Formação: Ciência da Computação na Universidade Federal de São Paulo."] }],
  projects: [{ name: "Catálogo Web", description: "Aplicação desenvolvida com React e TypeScript.", technologies: "React, TypeScript", link: "", sourceEvidence: ["Projeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript."] }],
  skills: [{ name: "React", sourceEvidence: ["Projeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript."] }],
  languages: [{ name: "Inglês", proficiency: "intermediário", sourceEvidence: ["Idiomas: Inglês intermediário."] }],
  certifications: [],
};

test("request accepts only extracted text, known area, and role within limits", () => {
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: source, area: "Full Stack", role: "Desenvolvedora" }).success, true);
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: source, area: "Full Stack", role: "D" }).success, false);
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: source, area: "Unknown", role: "Developer" }).success, false);
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: source, area: "Full Stack", role: "Developer", userId: randomUUID() }).success, false);
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: "x".repeat(200001), area: "Full Stack", role: "Developer" }).success, false);
  assert.equal(OptimizeResumeInputSchema.safeParse({ extractedText: " ".repeat(101), area: "Full Stack", role: "Developer" }).success, false);
});

test("candidate schema enforces existing resume field limits and rejects extra properties", () => {
  assert.equal(GeminiResumeCandidateSchema.safeParse(validCandidate).success, true);
  assert.equal(GeminiResumeCandidateSchema.safeParse({ ...validCandidate, unexpected: "x" }).success, false);
  assert.equal(GeminiResumeCandidateSchema.safeParse({ ...validCandidate, summary: "x".repeat(2001) }).success, false);
  assert.equal(GeminiResumeCandidateSchema.safeParse({ ...validCandidate, skills: [{ name: "x".repeat(101), sourceEvidence: ["React"] }] }).success, false);
});

test("candidate with factual fields unsupported by literal source evidence is rejected as a whole", () => {
  const unsupportedCompany = structuredClone(validCandidate);
  unsupportedCompany.experiences[0].company = "Other Corp";
  assert.equal(validateGeminiResumeCandidate(unsupportedCompany, source).success, false);

  const unsupportedDate = structuredClone(validCandidate);
  unsupportedDate.experiences[0].startDate = "2018";
  assert.equal(validateGeminiResumeCandidate(unsupportedDate, source).success, false);

  const unsupportedTechnology = structuredClone(validCandidate);
  unsupportedTechnology.projects[0].technologies = "React, Python";
  assert.equal(validateGeminiResumeCandidate(unsupportedTechnology, source).success, false);

  const unsupportedExperience = structuredClone(validCandidate);
  unsupportedExperience.experiences[0].sourceEvidence = ["Projeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript."];
  assert.equal(validateGeminiResumeCandidate(unsupportedExperience, source).success, false);

  const unsupportedSummary = structuredClone(validCandidate);
  unsupportedSummary.summary = "Desenvolvedora com experiência em Python na Acme.";
  assert.equal(validateGeminiResumeCandidate(unsupportedSummary, source).success, false);
});

test("missing source evidence is rejected and absent information remains empty", () => {
  const noEvidence = structuredClone(validCandidate);
  noEvidence.summaryEvidence = [];
  assert.equal(validateGeminiResumeCandidate(noEvidence, source).success, false);

  const sparse = {
    summary: "Desenvolvedora Full Stack",
    summaryEvidence: ["Cargo: Desenvolvedora Full Stack"],
    experiences: [], education: [], projects: [], skills: [], languages: [], certifications: [],
  };
  assert.equal(validateGeminiResumeCandidate(sparse, source).success, true);
});

test("projects remain projects and never become experience entries", () => {
  const candidate = structuredClone(validCandidate);
  candidate.experiences = [];
  const draft = buildOptimizedResumeDraft(candidate, source, "Desenvolvedora Full Stack");
  assert.equal(draft.experiences.length, 0);
  assert.equal(draft.projects.length, 1);
});

test("draft IDs are generated server-side and personal data is extracted locally", () => {
  const draft = buildOptimizedResumeDraft(validCandidate, source, "Desenvolvedora Full Stack");
  assert.equal(draft.desiredRole, "Desenvolvedora Full Stack");
  assert.equal(draft.personalInfo.fullName, "Ana Silva");
  assert.equal(draft.personalInfo.email, "ana@example.com");
  assert.ok(draft.experiences[0].id);
  assert.notEqual(draft.experiences[0].id, "model-id");
  assert.equal(Object.hasOwn(draft.experiences[0], "sourceEvidence"), false);
});

test("redaction removes labeled direct identifiers and location while preserving professional facts", () => {
  const redacted = redactResumeForOptimization("Nome: Ana Silva\nEmail: ana@example.com\nCidade/Estado: São Paulo/SP\nProjeto: Catálogo desenvolvido com React");
  assert.doesNotMatch(redacted, /Ana Silva|ana@example\.com|São Paulo/);
  assert.match(redacted, /Catálogo desenvolvido com React/);
});
