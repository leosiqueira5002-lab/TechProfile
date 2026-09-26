import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnalysisResultSchema,
  validateAnalysisInput,
  validateEvidence,
  redactResumeText,
} from "../features/analysis/contracts.ts";
import { analyzeResume, AnalysisProviderError } from "../features/analysis/provider.ts";

const source = "Desenvolvedora na Acme desde 2022. Construí APIs com Node.js e PostgreSQL.";

function result(overrides = {}) {
  return {
    summary: { text: "Atua como desenvolvedora e construiu APIs.", evidence: ["Desenvolvedora na Acme", "Construí APIs"] },
    strengths: [{ title: "Experiência em APIs", description: "Descreve construção de APIs.", evidence: ["Construí APIs com Node.js"] }],
    improvements: [],
    technologies: [{ name: "Node.js", context: "Usado na construção de APIs.", evidence: ["Node.js"] }],
    experiences: [{ company: "Acme", role: "Desenvolvedora", period: "desde 2022", summary: "Desenvolvimento de APIs.", evidence: ["Desenvolvedora na Acme desde 2022", "Construí APIs"] }],
    projects: [],
    education: [],
    certifications: [],
    categories: {
      experience: { status: "good", explanation: "Há uma experiência descrita.", evidence: ["Desenvolvedora na Acme"] },
      technologies: { status: "good", explanation: "Há tecnologias citadas.", evidence: ["Node.js e PostgreSQL"] },
      projects: { status: "not_mentioned", explanation: "Não encontramos projetos descritos no currículo.", evidence: [] },
      clarity: { status: "good", explanation: "As responsabilidades estão descritas diretamente.", evidence: ["Construí APIs"] },
      positioning: { status: "unclear", explanation: "O objetivo profissional não está explícito.", evidence: [] },
    },
    recommendations: [{ title: "Detalhar a experiência", description: "Se fizer sentido para você, explique o contexto das APIs descritas.", evidence: ["Construí APIs"] }],
    ...overrides,
  };
}

test("aceita resultado estruturado sem score inventado", () => {
  const parsed = AnalysisResultSchema.parse(result());
  assert.equal("score" in parsed, false);
});

test("rejeita propriedades não previstas no contrato", () => {
  assert.equal(AnalysisResultSchema.safeParse(result({ score: 92 })).success, false);
});

test("aceita áreas profissionais definidas e cargo informado", () => {
  assert.equal(validateAnalysisInput({ extractedText: source, area: "Back-end", role: "Backend Developer", analysisConfirmed: true }).success, true);
});

test("rejeita texto extraído vazio e entrada acima do limite", () => {
  assert.equal(validateAnalysisInput({ extractedText: " ", area: "Outra", role: "Engenheiro", analysisConfirmed: true }).success, false);
  assert.equal(validateAnalysisInput({ extractedText: "x".repeat(200_001), area: "Outra", role: "Engenheiro", analysisConfirmed: true }).success, false);
});

test("rejeita área ou cargo fora dos limites", () => {
  assert.equal(validateAnalysisInput({ extractedText: source, area: "Diretoria", role: "Backend", analysisConfirmed: true }).success, false);
  assert.equal(validateAnalysisInput({ extractedText: source, area: "Data", role: "x", analysisConfirmed: true }).success, false);
});

test("não permite chamar a IA sem confirmação explícita do processamento externo", () => {
  assert.equal(validateAnalysisInput({ extractedText: source, area: "Back-end", role: "Backend Developer" }).success, false);
});

test("cada citação apresentada como evidência precisa existir literalmente na fonte", () => {
  assert.equal(validateEvidence(result(), source).success, true);
  const invalid = result({ strengths: [{ title: "Experiência", description: "Liderança técnica.", evidence: ["Liderei 12 pessoas"] }] });
  assert.equal(validateEvidence(invalid, source).success, false);
});

test("campos factuais sem evidência são recusados", () => {
  const invalid = result({ experiences: [{ company: "Initech", role: "Staff Engineer", period: "2020-2024", summary: "Liderou equipe.", evidence: [] }] });
  assert.equal(validateEvidence(invalid, source).success, false);
});

test("lacuna permite texto neutro sem afirmar falta de competência", () => {
  const parsed = AnalysisResultSchema.parse(result());
  assert.equal(parsed.categories.projects.status, "not_mentioned");
  assert.deepEqual(parsed.categories.projects.evidence, []);
});

test("recomendações sem citação só passam se forem condicionais", () => {
  const conditional = result({ recommendations: [{ title: "Experiência (se aplicável)", description: "Se você possui essa experiência, considere incluí-la.", evidence: [] }] });
  const unconditional = result({ recommendations: [{ title: "Inclua sua experiência", description: "Você possui experiência profissional.", evidence: [] }] });
  assert.equal(validateEvidence(conditional, source).success, true);
  assert.equal(validateEvidence(unconditional, source).success, false);
});

test("tecnologias sem evidência e tecnologias inferidas não passam validação", () => {
  const invalid = result({ technologies: [{ name: "React", context: "Esperado para a função.", evidence: ["React"] }] });
  assert.equal(validateEvidence(invalid, source).success, false);
});

test("redige contatos diretos antes do envio ao provedor", () => {
  const text = redactResumeText("Nome Sobrenome\nEmail: pessoa@exemplo.com\nTelefone: +55 (11) 99999-1234\nLinkedIn: https://linkedin.com/in/pessoa\nNode.js");
  assert.doesNotMatch(text, /pessoa@exemplo.com|99999-1234|linkedin\.com/i);
  assert.match(text, /Node\.js/);
  assert.match(redactResumeText("Atuação entre 2020-2024"), /2020-2024/);
});

test("sem chave, falha antes de qualquer chamada externa", async () => {
  let called = false;
  await assert.rejects(analyzeResume({ extractedText: source, area: "Back-end", role: "Backend Developer", analysisConfirmed: true }, { apiKey: "", fetchImpl: async () => { called = true; return new Response(); } }), (error) => error instanceof AnalysisProviderError && error.kind === "not_configured");
  assert.equal(called, false);
});

test("envia somente texto reduzido e exige resposta estruturada com evidências", async () => {
  let outgoing;
  const analysis = result();
  const response = await analyzeResume(
    { extractedText: `${source}\nContato: pessoa@exemplo.com\nTelefone: +55 (11) 99999-1234`, area: "Back-end", role: "Backend Developer", analysisConfirmed: true },
    { apiKey: "test-only", model: "gpt-4.1-mini", fetchImpl: async (_url, init) => {
      outgoing = JSON.parse(init.body);
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(analysis) }] }] });
    } },
  );
  assert.equal(response.technologies[0].name, "Node.js");
  assert.equal(outgoing.store, false);
  assert.equal(outgoing.model, "gpt-4.1-mini");
  const sentText = outgoing.input[1].content[0].text;
  assert.doesNotMatch(sentText, /pessoa@exemplo\.com|99999-1234/);
  assert.match(sentText, /2022/);
});

test("resposta do provedor sem evidência exata é rejeitada sem expor o conteúdo", async () => {
  const hallucinated = result({ strengths: [{ title: "Liderança", description: "Liderou uma equipe.", evidence: ["Liderei 12 pessoas"] }] });
  await assert.rejects(analyzeResume({ extractedText: source, area: "Back-end", role: "Backend Developer", analysisConfirmed: true }, { apiKey: "test-only", fetchImpl: async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(hallucinated) }] }] }) }), (error) => error instanceof AnalysisProviderError && error.kind === "invalid_response");
});

test("erros HTTP externos não são repassados ao cliente", async () => {
  await assert.rejects(analyzeResume({ extractedText: source, area: "Back-end", role: "Backend Developer", analysisConfirmed: true }, { apiKey: "test-only", fetchImpl: async () => new Response("secret provider detail", { status: 429 }) }), (error) => error instanceof AnalysisProviderError && error.kind === "provider" && !error.message.includes("secret"));
});
