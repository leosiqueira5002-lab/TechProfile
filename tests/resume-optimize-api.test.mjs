import test from "node:test";
import assert from "node:assert/strict";
import { createResumeOptimizationHandler } from "../features/resume/optimization-api.ts";
import { GeminiResumeError } from "../features/resume/providers/gemini.ts";
import { createEmptyResumeDraft } from "../features/resume/model.ts";

const body = { extractedText: "Currículo de profissional de tecnologia. ".repeat(4), area: "Full Stack", role: "Desenvolvedora" };
const draft = { ...createEmptyResumeDraft(), desiredRole: "Desenvolvedora" };
const pro = { plan: "pro", pro_expires_at: "2035-01-01T00:00:00.000Z" };

function request(payload = body, headers = { "content-type": "application/json", "x-resume-gemini-consent": "true" }) {
  return new Request("http://localhost/api/resumes/optimize", { method: "POST", headers, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
}

function setup({ authenticated = true, profile = pro, optimize = async () => draft } = {}) {
  let calls = 0;
  const handler = createResumeOptimizationHandler({
    isAuthenticated: async () => authenticated,
    getProfile: async () => profile,
    optimize: async (input) => { calls += 1; return optimize(input); },
    now: () => new Date("2030-01-01T00:00:00.000Z"),
  });
  return { handler, calls: () => calls };
}

test("rejects unauthenticated, Free, expired, missing, and malformed profiles before provider use", async () => {
  for (const state of [
    { authenticated: false, profile: pro, status: 401 },
    { authenticated: true, profile: { plan: "free", pro_expires_at: null }, status: 403 },
    { authenticated: true, profile: { plan: "pro", pro_expires_at: "2020-01-01" }, status: 403 },
    { authenticated: true, profile: null, status: 403 },
    { authenticated: true, profile: { plan: "pro", pro_expires_at: "invalid" }, status: 403 },
  ]) {
    const instance = setup(state);
    const response = await instance.handler(request());
    assert.equal(response.status, state.status);
    assert.equal(instance.calls(), 0);
  }
});

test("active Pro passes validated request to provider and returns its draft", async () => {
  let received;
  const instance = setup({ optimize: async (input) => { received = input; return draft; } });
  const response = await instance.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { draft });
  assert.equal(received.area, body.area);
  assert.equal(instance.calls(), 1);
});

test("requires explicit Gemini consent header before provider use", async () => {
  const instance = setup();
  const noConsent = await instance.handler(request(body, { "content-type": "application/json" }));
  assert.equal(noConsent.status, 400);
  assert.equal(instance.calls(), 0);
  const consented = await instance.handler(request(body, { "content-type": "application/json", "x-resume-gemini-consent": "true" }));
  assert.equal(consented.status, 200);
  assert.equal(instance.calls(), 1);
});

test("rejects insufficient text with 422 and invalid area/role or extra keys with 400", async () => {
  for (const [payload, status] of [
    [{ ...body, extractedText: "too short" }, 422],
    [{ ...body, area: "unknown" }, 400],
    [{ ...body, role: "x" }, 400],
    [{ ...body, isPro: true }, 400],
  ]) {
    const instance = setup();
    assert.equal((await instance.handler(request(payload))).status, status);
    assert.equal(instance.calls(), 0);
  }
});

test("bounds body size and rejects non-JSON content", async () => {
  const instance = setup();
  const large = request({ ...body, extractedText: "x".repeat(200001) });
  assert.equal((await instance.handler(large)).status, 413);
  assert.equal((await instance.handler(request("{}", { "content-type": "text/plain" }))).status, 400);
  assert.equal(instance.calls(), 0);
});

test("maps provider failures to safe statuses and messages", async () => {
  for (const [kind, status] of [["not_configured", 503], ["invalid_response", 502], ["unavailable", 503], ["timeout", 504]]) {
    const instance = setup({ optimize: async () => { throw new GeminiResumeError(kind); } });
    const response = await instance.handler(request());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /GEMINI_API_KEY|vendor|stack/i);
  }
});
