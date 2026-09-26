import assert from "node:assert/strict";
import { test } from "node:test";

const baseUrl = process.env.ANALYSIS_TEST_URL ?? "http://localhost:3000";

test("currículo válido retorna análise demo pelo endpoint sem chave externa", async () => {
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      extractedText: "RESUMO PROFISSIONAL\nProfissional de tecnologia com interesse em desenvolvimento e construção de sistemas para diferentes necessidades.\nEXPERIÊNCIA PROFISSIONAL\nDesenvolvedora na Acme com Node.js e PostgreSQL.",
      area: "Back-end",
      role: "Backend Developer",
      analysisConfirmed: true,
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(typeof payload.analysis.summary.text, "string");
  assert.equal(Object.keys(payload.analysis.categories).length, 5);
  assert.ok(payload.analysis.technologies.some((item) => item.name === "Node.js"));
});

test("texto extraído curto retorna mensagem apropriada para a demo", async () => {
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ extractedText: "Texto curto sem contexto.", area: "Back-end", role: "Backend Developer", analysisConfirmed: true }),
  });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /curto demais/i);
});

test("rota de análise rejeita contexto profissional inválido sem ecoar dados", async () => {
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ extractedText: "currículo privado", area: "Diretoria", role: "Engenheiro" }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /área profissional/);
  assert.doesNotMatch(JSON.stringify(payload), /currículo privado/);
});

test("rota não aceita análise sem confirmação de processamento externo", async () => {
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ extractedText: "currículo privado", area: "Back-end", role: "Backend Developer" }),
  });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /currículo privado/);
});

test("rota de análise rejeita corpo acima do limite antes de processar", async () => {
  const largeText = "x".repeat(820_000);
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ extractedText: largeText, area: "Outra", role: "Engenheira" }),
  });
  assert.equal(response.status, 413);
  assert.doesNotMatch(await response.text(), /x{100}/);
});

test("rota de análise recusa payload não JSON com mensagem neutra", async () => {
  const response = await fetch(`${baseUrl}/api/analyses`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "currículo privado",
  });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /currículo privado/);
});
