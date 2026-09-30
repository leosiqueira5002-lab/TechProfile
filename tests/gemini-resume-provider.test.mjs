import test from "node:test";
import assert from "node:assert/strict";
import { optimizeWithGemini, GeminiResumeError } from "../features/resume/providers/gemini.ts";
import { RESUME_OPTIMIZATION_SYSTEM_INSTRUCTION } from "../features/resume/optimization-prompt.ts";

const source = `Ana Silva\nEmail: ana@example.com\nCidade/Estado: São Paulo/SP\nCargo: Desenvolvedora Full Stack\nTrabalhei como Desenvolvedora na Acme de 2021 a 2024.\nProjeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript.\nFormação: Ciência da Computação na Universidade Federal de São Paulo.\nIdiomas: Inglês intermediário. Texto complementar para atingir o mínimo necessário.`;
const candidate = {
  summary: "Desenvolvedora com experiência na Acme.", summaryEvidence: ["Trabalhei como Desenvolvedora na Acme de 2021 a 2024."],
  experiences: [{ company: "Acme", position: "Desenvolvedora", startDate: "2021", endDate: "2024", isCurrent: false, description: "Trabalhei como Desenvolvedora na Acme de 2021 a 2024.", sourceEvidence: ["Trabalhei como Desenvolvedora na Acme de 2021 a 2024."] }],
  education: [], projects: [{ name: "Catálogo Web", description: "Aplicação desenvolvida", technologies: "React, TypeScript", link: "", sourceEvidence: ["Projeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript."] }],
  skills: [{ name: "React", sourceEvidence: ["Projeto pessoal: Catálogo Web — Aplicação desenvolvida com React e TypeScript."] }], languages: [], certifications: [],
};

function fakeClient(response, capture = () => {}) {
  return { models: { generateContent: async (request) => { capture(request); return { text: JSON.stringify(response) }; } } };
}

test("uses configured model, JSON schema, fixed safety prompt, and only redacted resume text", async () => {
  let request;
  const draft = await optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Desenvolvedora Full Stack" }, {
    client: fakeClient(candidate, (value) => { request = value; }),
    model: "gemini-test-model",
  });
  assert.equal(request.model, "gemini-test-model");
  assert.equal(request.config.responseMimeType, "application/json");
  assert.ok(request.config.responseSchema);
  assert.match(request.config.systemInstruction, /Projetos pessoais ou acadêmicos/);
  assert.doesNotMatch(request.contents, /ana@example\.com|Ana Silva/);
  assert.equal(draft.personalInfo.email, "ana@example.com");
  assert.equal(draft.experiences.length, 1);
  assert.equal(draft.projects.length, 1);
});

test("fails closed when API key or model is missing", async () => {
  const input = { extractedText: source, area: "Full Stack", role: "Developer" };
  await assert.rejects(optimizeWithGemini(input, { apiKey: "", model: "gemini-test" }), (error) => error instanceof GeminiResumeError && error.kind === "not_configured");
  await assert.rejects(optimizeWithGemini(input, { client: fakeClient(candidate), model: "" }), (error) => error instanceof GeminiResumeError && error.kind === "not_configured");
});

test("rejects empty, malformed, blocked, and evidence-invalid model responses", async () => {
  const input = { extractedText: source, area: "Full Stack", role: "Developer" };
  for (const response of [{ text: "" }, { text: "not-json" }, { text: null, promptFeedback: { blockReason: "SAFETY" } }]) {
    await assert.rejects(optimizeWithGemini(input, { model: "gemini-test", client: { models: { generateContent: async () => response } } }), (error) => error instanceof GeminiResumeError && error.kind === "invalid_response");
  }
  const fabricated = structuredClone(candidate);
  fabricated.skills[0].name = "Python";
  await assert.rejects(optimizeWithGemini(input, { model: "gemini-test", client: fakeClient(fabricated) }), (error) => error instanceof GeminiResumeError && error.kind === "invalid_response");
});

test("maps provider failure and timeout without exposing raw errors", async () => {
  const input = { extractedText: source, area: "Full Stack", role: "Developer" };
  await assert.rejects(optimizeWithGemini(input, {
    model: "gemini-test", client: { models: { generateContent: async () => { throw new Error("sensitive vendor details"); } } },
  }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable" && !error.message.includes("sensitive"));
  await assert.rejects(optimizeWithGemini(input, {
    model: "gemini-test", timeoutMs: 5, client: { models: { generateContent: () => new Promise(() => {}) } },
  }), (error) => error instanceof GeminiResumeError && error.kind === "timeout");
  assert.match(RESUME_OPTIMIZATION_SYSTEM_INSTRUCTION, /Nunca invente/i);
});
