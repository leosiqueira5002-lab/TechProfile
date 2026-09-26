import assert from "node:assert/strict";
import { test } from "node:test";
import { AnalysisResultSchema } from "../features/analysis/contracts.ts";
import { AnalysisProviderError } from "../features/analysis/provider.ts";
import { analysisProvider } from "../features/analysis/providers/index.ts";
import { demoAnalysisProvider } from "../features/analysis/providers/mock.ts";

const input = (extractedText) => ({
  extractedText,
  area: "Back-end",
  role: "Backend Developer",
  analysisConfirmed: true,
});

const completeResume = `
RESUMO PROFISSIONAL
Desenvolvedora de software com atuação em aplicações web.

EXPERIÊNCIA PROFISSIONAL
Desenvolvedora na Acme, de 2022 a 2025. Construí APIs com Node.js e PostgreSQL.

PROJETOS
Painel interno desenvolvido com React e TypeScript.

FORMAÇÃO
Tecnologia em Sistemas para Internet, Instituto Exemplo, 2021.

CERTIFICAÇÕES
AWS Certified Cloud Practitioner, 2023.
`;

test("currículo válido gera análise demo estruturada sem chamada externa", async () => {
  const result = await demoAnalysisProvider.analyze(input(completeResume));

  assert.equal(demoAnalysisProvider.mode, "demo");
  assert.equal(AnalysisResultSchema.safeParse(result).success, true);
  assert.deepEqual(result.technologies.map(({ name }) => name), ["Node.js", "PostgreSQL", "React", "TypeScript", "AWS"]);
  assert.equal(result.experiences.length, 1);
  assert.equal(result.projects.length, 1);
  assert.equal(result.education.length, 1);
  assert.equal(result.certifications.length, 1);
});

test("provedor ativo permanece em modo demo mesmo que exista uma chave OpenAI", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sentinel-sem-uso";
  try {
    assert.equal(analysisProvider.mode, "demo");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("texto curto retorna erro claro de conteúdo insuficiente", async () => {
  await assert.rejects(demoAnalysisProvider.analyze(input("Desenvolvedora com experiência em tecnologia.")), (error) =>
    error instanceof AnalysisProviderError && error.kind === "insufficient_text",
  );
});

test("tecnologias ausentes não viram afirmação de falta de competência", async () => {
  const result = await demoAnalysisProvider.analyze(input(`
    RESUMO PROFISSIONAL
    Profissional de tecnologia com interesse em desenvolvimento e aprendizado contínuo.
    Busco uma oportunidade para contribuir em equipes de produto e software.
    Tenho interesse em comunicação, organização e melhoria dos processos de trabalho.
  `));

  assert.deepEqual(result.technologies, []);
  assert.equal(result.categories.technologies.status, "not_mentioned");
  assert.match(result.categories.technologies.explanation, /não foram identificadas|não foi identificada/i);
  assert.doesNotMatch(JSON.stringify(result), /não conhece|não possui|não sabe/i);
});

test("experiência ausente é descrita como não identificada no documento", async () => {
  const result = await demoAnalysisProvider.analyze(input(`
    PERFIL PROFISSIONAL
    Profissional de tecnologia com interesse em desenvolvimento e aprendizado contínuo.
    Busco uma oportunidade para contribuir em equipes de produto e software.
    Tenho interesse em comunicação, organização e melhoria dos processos de trabalho.
  `));

  assert.deepEqual(result.experiences, []);
  assert.equal(result.categories.experience.status, "not_mentioned");
  assert.match(result.categories.experience.explanation, /não foi identificada/i);
  assert.doesNotMatch(JSON.stringify(result), /não possui experiência|nunca trabalhou/i);
  assert.ok(result.recommendations.some((item) => /se você possui/i.test(item.description)));
});

test("resultado demo sempre passa pelo mesmo schema estrito da análise real", async () => {
  const result = await demoAnalysisProvider.analyze(input(completeResume));
  assert.equal(AnalysisResultSchema.safeParse({ ...result, score: 87 }).success, false);
  assert.deepEqual(Object.keys(result.categories).sort(), ["clarity", "experience", "positioning", "projects", "technologies"]);
});

const resumeWithoutHeadings = `
Engenharia de Software — cursando, 4º período na Faculdade Horizonte.
Idiomas: Inglês intermediário; Espanhol básico.
LinkedIn: https://www.linkedin.com/in/perfil-ficticio
GitHub: https://github.com/perfil-ficticio
Lista projetos: Agenda Verde, sistema web para organizar hortas comunitárias.
Projeto publicado no LinkedIn: Mapa Acessível, aplicação de rotas acessíveis.
Repositório: github.com/perfil-ficticio/mapa-acessivel
Objetivo: atuar como Desenvolvedora Full Stack.
Contato: pessoa.teste@example.invalid | Telefone: (11) 90000-0000
Endereço: Rua Fictícia, 123, Cidade Exemplo
`;

test("reconhece formação por curso, instituição, período e status sem seção nomeada", async () => {
  const result = await demoAnalysisProvider.analyze(input(resumeWithoutHeadings));
  assert.equal(result.education.length, 1);
  assert.match(result.education[0].name, /Engenharia de Software/);
  assert.ok(result.education[0].evidence.some((item) => /4º período|cursando|Faculdade Horizonte/.test(item)));
});

test("reconhece projetos descritos sem título de seção exato", async () => {
  const result = await demoAnalysisProvider.analyze(input(resumeWithoutHeadings));
  assert.ok(result.projects.length >= 2);
  assert.ok(result.projects.some((project) => project.evidence.some((item) => /Agenda Verde|hortas comunitárias/.test(item))));
  assert.ok(result.projects.some((project) => project.evidence.some((item) => /Mapa Acessível|publicado no LinkedIn/.test(item))));
});

test("reconhece LinkedIn, GitHub e repositórios sem expor as URLs", async () => {
  const result = await demoAnalysisProvider.analyze(input(resumeWithoutHeadings));
  const facts = JSON.stringify(result);
  assert.match(facts, /LinkedIn/i);
  assert.match(facts, /GitHub/i);
  assert.doesNotMatch(facts, /https?:\/\/|github\.com\/|linkedin\.com\/in/);
});

test("reconhece idiomas e mantém os níveis literalmente informados", async () => {
  const result = await demoAnalysisProvider.analyze(input(resumeWithoutHeadings));
  const facts = JSON.stringify(result);
  assert.match(facts, /Inglês intermediário/);
  assert.match(facts, /Espanhol básico/);
});

test("não trata projetos como emprego e usa resumo demonstrativo sem copiar dados pessoais", async () => {
  const result = await demoAnalysisProvider.analyze(input(resumeWithoutHeadings));
  assert.deepEqual(result.experiences, []);
  assert.match(result.categories.experience.explanation, /experiência profissional não foi identificada/i);
  assert.match(result.summary.text, /não foi identificado um resumo profissional/i);
  assert.doesNotMatch(JSON.stringify(result), /pessoa\.teste|90000-0000|Rua Fictícia|Cidade Exemplo/);
});

test("não inventa tecnologias a partir de menções genéricas", async () => {
  const result = await demoAnalysisProvider.analyze(input(`
    Profissional cursando Administração com interesse em tecnologia, comunicação e projetos acadêmicos.
    Desenvolve atividades em equipe, aprende continuamente e busca uma oportunidade profissional.
    Participou de iniciativas estudantis e organizou conteúdo para apresentação de trabalhos.
  `));
  assert.deepEqual(result.technologies, []);
});
