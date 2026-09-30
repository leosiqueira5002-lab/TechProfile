import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createResumeOptimizationAction } from "../features/resume/optimization-client.ts";

const input = { extractedText: "Texto extraído do currículo", area: "Full Stack", role: "Desenvolvedora" };
const draft = { personalInfo: {}, desiredRole: "Desenvolvedora" };
const response = (ok, value) => ({ ok, json: async () => value });

test("CTA component includes separate Gemini consent and clear privacy disclosure", async () => {
  const source = await readFile(new URL("../features/resume/components/resume-optimization-cta.tsx", import.meta.url), "utf8");
  assert.match(source, /Gerar currículo otimizado com IA/);
  assert.match(source, /texto extraído será enviado ao Google Gemini/);
  assert.match(source, /Identificadores diretos/);
  assert.match(source, /tempo limitado/);
  assert.match(source, /disabled={!consent \|\| loading}/);
});

test("Free CTA renders the Pro checkout path and never renders the Gemini submission control", async () => {
  const source = await readFile(new URL("../features/resume/components/resume-optimization-cta.tsx", import.meta.url), "utf8");
  assert.match(source, /isPro \? <>/);
  assert.match(source, /<\/>(?:\s*): <>[\s\S]*DISPONÍVEL NO PRO/);
  assert.match(source, /SubscribeProButton label="Assinar Pro — R\$ 19,90"/);
  assert.match(source, /\{loading \? "Gerando currículo…" : "Gerar currículo otimizado com IA"\}/);
});

test("client-side optimization modules contain no server credentials", async () => {
  const paths = [
    "../features/resume/components/resume-optimization-cta.tsx",
    "../features/resume/optimization-client.ts",
    "../features/resume/resume-draft-context.tsx",
    "../components/resume-analysis-workspace.tsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.doesNotMatch(sources.join("\n"), /GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|MERCADO_PAGO_ACCESS_TOKEN|NEXT_PUBLIC_GEMINI/);
});

test("Pro flow sends only extracted text, area and role, then hands draft to editor", async () => {
  let request;
  let installedDraft;
  let route;
  const action = createResumeOptimizationAction({
    fetchImpl: async (url, init) => { request = { url, init }; return response(true, { draft }); },
    onLoadingChange: () => {}, onError: () => {}, setDraft: (value) => { installedDraft = value; }, navigate: (value) => { route = value; },
  });
  await action(input);
  assert.equal(request.url, "/api/resumes/optimize");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["x-resume-gemini-consent"], "true");
  assert.deepEqual(JSON.parse(request.init.body), input);
  assert.deepEqual(installedDraft, draft);
  assert.equal(route, "/curriculo");
});

test("repeated clicks during generation issue only one request", async () => {
  let resolveFetch;
  let requests = 0;
  const states = [];
  const action = createResumeOptimizationAction({
    fetchImpl: () => { requests += 1; return new Promise((resolve) => { resolveFetch = resolve; }); },
    onLoadingChange: (value) => states.push(value), onError: () => {}, setDraft: () => {}, navigate: () => {},
  });
  const first = action(input);
  const second = action(input);
  assert.equal(requests, 1);
  resolveFetch(response(true, { draft }));
  await Promise.all([first, second]);
  assert.deepEqual(states, [true, false]);
});

test("failure keeps the existing draft and route untouched and shows a safe error", async () => {
  let installs = 0;
  let navigations = 0;
  let message = "";
  const action = createResumeOptimizationAction({
    fetchImpl: async () => response(false, { error: "private upstream response" }),
    onLoadingChange: () => {}, onError: (value) => { message = value; }, setDraft: () => { installs += 1; }, navigate: () => { navigations += 1; },
  });
  await action(input);
  assert.equal(installs, 0);
  assert.equal(navigations, 0);
  assert.equal(message, "Não foi possível gerar o currículo agora. Tente novamente.");
});
