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
      sleep: async () => {},
    }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
  } finally {
    console.error = originalError;
  }

  assert.equal(records.length, 3);
  for (const [index, log] of records.entries()) {
    assert.match(log, /gemini_attempt/);
    assert.match(log, /gemini-3\.8-flash/);
    assert.match(log, /503/);
    assert.match(log, /google_service_error/);
    assert.match(log, new RegExp(`"attempt":${index + 1}`));
    assert.match(log, new RegExp(`"willRetry":${index < 2}`));
    assert.doesNotMatch(log, /"errorName"|"code"|"message"|"stage"/);
    assert.doesNotMatch(log, /test-secret-key|ana@example\.com|Trabalhei como Desenvolvedora|raw Google payload/);
  }
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
        sleep: async () => {},
      }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
    }
  } finally {
    console.error = originalError;
  }
  for (const [status, , category] of cases) {
    const matchingLogs = records.filter((log) => log.includes(`"httpStatus":${status}`));
    assert.ok(matchingLogs.length >= 1);
    assert.equal(matchingLogs.length, status === 429 || status === 503 ? 3 : 1);
    for (const log of matchingLogs) {
      assert.match(log, new RegExp(`"category":"${category}"`));
      assert.match(log, /"event":"gemini_attempt"/);
      assert.match(log, /"model":"gemini-3\.8-flash"/);
      assert.match(log, /"attempt":[1-3]/);
      assert.match(log, /"willRetry":(true|false)/);
      assert.doesNotMatch(log, /"errorName"|"code"|"message"|"stage"/);
      assert.doesNotMatch(log, /private error payload/);
    }
  }
});

function apiFailure(status) {
  const codes = {
    400: "INVALID_ARGUMENT",
    401: "UNAUTHENTICATED",
    403: "PERMISSION_DENIED",
    408: "REQUEST_TIMEOUT",
    429: "RESOURCE_EXHAUSTED",
    500: "INTERNAL",
    502: "BAD_GATEWAY",
    503: "UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
  };
  return new ApiError({ message: `got status: ${codes[status] ?? "UNKNOWN"}.`, status });
}

function captureLogs(run) {
  const records = [];
  const originalError = console.error;
  console.error = (...args) => records.push(args.join(" "));
  return run(records).finally(() => { console.error = originalError; });
}

test("retries a transient 503 once and succeeds", async () => {
  let calls = 0;
  const delays = [];
  await captureLogs(async (records) => {
    const result = await optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-test",
      client: { models: { generateContent: async () => {
        calls += 1;
        if (calls === 1) throw apiFailure(503);
        return { text: JSON.stringify(candidate) };
      } } },
      random: () => 0.5,
      sleep: async (ms) => { delays.push(ms); },
    });
    assert.equal(result.experiences.length, 1);
    assert.equal(calls, 2);
    assert.deepEqual(delays, [1125]);
    assert.match(records[0], /"attempt":1/);
    assert.match(records[0], /"httpStatus":503/);
    assert.match(records[0], /"willRetry":true/);
  });
});

test("retries two transient 503 errors with exponential delays then succeeds", async () => {
  let calls = 0;
  const delays = [];
  await captureLogs(async () => {
    await optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-test",
      client: { models: { generateContent: async () => {
        calls += 1;
        if (calls < 3) throw apiFailure(503);
        return { text: JSON.stringify(candidate) };
      } } },
      random: () => 0,
      sleep: async (ms) => { delays.push(ms); },
    });
  });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("three transient 503 errors exhaust the attempt limit", async () => {
  let calls = 0;
  const delays = [];
  await captureLogs(async (records) => {
    await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-test",
      client: { models: { generateContent: async () => { calls += 1; throw apiFailure(503); } } },
      random: () => 0,
      sleep: async (ms) => { delays.push(ms); },
    }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
    assert.equal(records.length, 3);
    assert.match(records.at(-1), /"attempt":3/);
    assert.match(records.at(-1), /"willRetry":false/);
  });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("retries each configured transient HTTP status", async () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    let calls = 0;
    await captureLogs(async () => {
      await optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
        model: `gemini-retry-${status}`,
        client: { models: { generateContent: async () => {
          calls += 1;
          if (calls === 1) throw apiFailure(status);
          return { text: JSON.stringify(candidate) };
        } } },
        random: () => 0,
        sleep: async () => {},
      });
    });
    assert.equal(calls, 2, `HTTP ${status} should retry once`);
  }
});

test("does not retry HTTP 400, 401 or 403", async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await captureLogs(async (records) => {
      await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
        model: "gemini-test",
        client: { models: { generateContent: async () => { calls += 1; throw apiFailure(status); } } },
        sleep: async () => assert.fail("non-transient status must not sleep"),
      }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
      assert.match(records[0], /"willRetry":false/);
    });
    assert.equal(calls, 1);
  }
});

test("does not retry invalid structured output", async () => {
  let calls = 0;
  await captureLogs(async () => {
    await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-test",
      client: { models: { generateContent: async () => { calls += 1; return { text: "not-json" }; } } },
      sleep: async () => assert.fail("invalid structured output must not sleep"),
    }), (error) => error instanceof GeminiResumeError && error.kind === "invalid_response");
  });
  assert.equal(calls, 1);
});

test("does not wait for a retry that cannot fit in the remaining timeout budget", async () => {
  let calls = 0;
  let slept = false;
  await captureLogs(async (records) => {
    await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-test",
      timeoutMs: 5,
      client: { models: { generateContent: async () => { calls += 1; throw apiFailure(503); } } },
      random: () => 0,
      sleep: async () => { slept = true; },
    }), (error) => error instanceof GeminiResumeError && error.kind === "unavailable");
    assert.match(records[0], /"willRetry":false/);
  });
  assert.equal(calls, 1);
  assert.equal(slept, false);
});

test("aborts an in-progress retry wait when the total timeout expires", async () => {
  let calls = 0;
  let sleepAborted = false;
  await captureLogs(async () => {
    await assert.rejects(optimizeWithGemini({ extractedText: source, area: "Full Stack", role: "Developer" }, {
      model: "gemini-timeout-during-backoff",
      timeoutMs: 1_100,
      client: { models: { generateContent: async () => { calls += 1; throw apiFailure(503); } } },
      random: () => 0,
      sleep: (_ms, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => { sleepAborted = true; reject(new Error("aborted")); }, { once: true });
      }),
    }), (error) => error instanceof GeminiResumeError && error.kind === "timeout");
  });
  assert.equal(calls, 1);
  assert.equal(sleepAborted, true);
});
