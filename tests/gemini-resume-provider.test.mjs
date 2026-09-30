import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@google/genai";
import { GEMINI_RESUME_RESPONSE_SCHEMA } from "../features/resume/optimization-contract.ts";
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
  assert.deepEqual(request.config.responseJsonSchema, GEMINI_RESUME_RESPONSE_SCHEMA);
  assert.match(request.config.systemInstruction, /Projetos pessoais ou acadêmicos/);
  assert.doesNotMatch(request.contents, /ana@example\.com|Ana Silva/);
  assert.equal(draft.personalInfo.email, "ana@example.com");
  assert.equal(draft.experiences.length, 1);
  assert.equal(draft.projects.length, 1);
});

test("Gemini structured schema uses only supported keywords while Zod keeps server validation", () => {
  const supported = new Set([
    "$id", "$defs", "$ref", "$anchor",
    "type", "format", "title", "description", "enum", "items", "prefixItems", "minItems", "maxItems",
    "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties", "required",
  ]);
  const found = new Set();
  const visit = (value, isPropertyMap = false) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach((entry) => visit(entry));
    for (const [key, child] of Object.entries(value)) {
      if (!isPropertyMap) found.add(key);
      visit(child, key === "properties");
    }
  };
  visit(GEMINI_RESUME_RESPONSE_SCHEMA);
  assert.deepEqual([...found].filter((key) => !supported.has(key)), []);
  assert.equal(GEMINI_RESUME_RESPONSE_SCHEMA.type, "object");
  assert.ok(GEMINI_RESUME_RESPONSE_SCHEMA.properties.experiences);
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

test("logs safe Gemini HTTP diagnostics without logging raw errors, keys, or resume data", async () => {
  const input = { extractedText: source, area: "Full Stack", role: "Developer" };
  const records = [];
  const originalError = console.error;
  console.error = (...args) => records.push(args.join(" "));
  try {
    await assert.rejects(optimizeWithGemini(input, {
      apiKey: "test-secret-key",
      model: "gemini-3.8-flash",
      client: { models: { generateContent: async () => {
        throw new ApiError({
          message: 'got status: UNAVAILABLE. {"error":{"code":503,"message":"raw Google payload test-secret-key ana@example.com"}} ' + source,
          status: 503,
        });
      } } },
    }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
  } finally {
    console.error = originalError;
  }

  assert.equal(records.length, 1);
  const log = records[0];
  assert.match(log, /gemini_request/);
  assert.match(log, /gemini-3\.8-flash/);
  assert.match(log, /503/);
  assert.match(log, /UNAVAILABLE/);
  assert.doesNotMatch(log, /test-secret-key|ana@example\.com|Trabalhei como Desenvolvedora|raw Google payload/);
});

test("logs structured-output failures at the structured_output stage with safe summaries", async () => {
  const records = [];
  const originalError = console.error;
  console.error = (...args) => records.push(args.join(" "));
  try {
    await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-3.8-flash",
      client: fakeClient({ ...candidate, unsafeModelPayload: "private-response-fragment" }),
    }), (error) => error instanceof GeminiResumeError && error.kind === "invalid_response");
  } finally {
    console.error = originalError;
  }
  assert.equal(records.length, 1);
  assert.match(records[0], /structured_output/);
  assert.match(records[0], /gemini-3\.8-flash/);
  assert.doesNotMatch(records[0], /private-response-fragment|Trabalhei como Desenvolvedora|ana@example\.com/);
});

test("categorizes Gemini HTTP failures without preserving vendor messages", async () => {
  const cases = [
    [400, "INVALID_ARGUMENT", "bad_request_or_schema"],
    [401, "UNAUTHENTICATED", "authentication_rejected"],
    [403, "PERMISSION_DENIED", "permission_or_project_restriction"],
    [404, "NOT_FOUND", "model_or_endpoint_not_found"],
    [429, "RESOURCE_EXHAUSTED", "quota_or_rate_limit"],
    [503, "UNAVAILABLE", "google_service_error"],
  ];
  const records = [];
  const originalError = console.error;
  console.error = (...args) => records.push(args.join(" "));
  try {
    for (const [status, code] of cases) {
      await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
        model: "gemini-3.8-flash",
        client: { models: { generateContent: async () => {
          throw new ApiError({ message: `got status: ${code}. {"error":{"message":"private error payload"}}`, status });
        } } },
      }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
    }
  } finally {
    console.error = originalError;
  }
  assert.equal(records.length, cases.length);
  for (let index = 0; index < cases.length; index += 1) {
    assert.match(records[index], new RegExp(`"httpStatus":${cases[index][0]}`));
    assert.match(records[index], new RegExp(`"code":"${cases[index][1]}"`));
    assert.match(records[index], new RegExp(`"category":"${cases[index][2]}"`));
    assert.doesNotMatch(records[index], /private error payload/);
  }
});
