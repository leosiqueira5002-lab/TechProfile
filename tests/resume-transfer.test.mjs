import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { mapResumeToDraft } from "../features/resume/transfer.ts";

const analysis = (overrides = {}) => ({
  education: [],
  projects: [],
  experiences: [],
  technologies: [],
  certifications: [],
  ...overrides,
});

test("transfere o cargo desejado informado em /analise", () => {
  const draft = mapResumeToDraft({ extractedText: "", role: "Backend Developer", analysis: analysis() });
  assert.equal(draft.desiredRole, "Backend Developer");
});

test("transfere formação e só datas, curso, instituição e status explícitos", () => {
  const evidence = "Engenharia de Software — cursando, 4º período na Faculdade Horizonte, 2022–2026";
  const draft = mapResumeToDraft({
    extractedText: `FORMAÇÃO\n${evidence}`,
    role: "Desenvolvedora",
    analysis: analysis({ education: [{ name: evidence, institution: null, period: null, evidence: [evidence] }] }),
  });
  assert.equal(draft.education.length, 1);
  assert.equal(draft.education[0].course, "Engenharia de Software");
  assert.equal(draft.education[0].institution, "Faculdade Horizonte");
  assert.equal(draft.education[0].startDate, "2022");
  assert.equal(draft.education[0].completionDate, "2026");
  assert.match(draft.education[0].status, /cursando/i);
});

test("combina evidências separadas da mesma formação sem completar dados ausentes", () => {
  const evidence = ["Engenharia de Software", "Faculdade Horizonte", "Início: 2022", "Conclusão prevista: 2026", "Status: cursando"];
  const draft = mapResumeToDraft({
    extractedText: evidence.join("\n"),
    role: "",
    analysis: analysis({ education: [{ name: evidence[0], institution: "Faculdade Horizonte", period: null, evidence }] }),
  });
  assert.equal(draft.education[0].course, "Engenharia de Software");
  assert.equal(draft.education[0].institution, "Faculdade Horizonte");
  assert.equal(draft.education[0].startDate, "2022");
  assert.equal(draft.education[0].completionDate, "2026");
  assert.equal(draft.education[0].status, "cursando");
});

test("transfere projeto descrito com nome e tecnologias explicitamente evidenciados", () => {
  const evidence = "Projeto: Painel de alertas - Aplicação para monitorar falhas com TypeScript e React.";
  const draft = mapResumeToDraft({
    extractedText: `PROJETOS\n${evidence}`,
    role: "",
    analysis: analysis({ projects: [{ name: "Painel de alertas", description: "descrição demonstrativa", technologies: ["TypeScript", "React"], evidence: [evidence] }], technologies: [
      { name: "TypeScript", context: "Menção literal.", evidence: ["TypeScript"] },
      { name: "React", context: "Menção literal.", evidence: ["React"] },
    ] }),
  });
  assert.equal(draft.projects.length, 1);
  assert.equal(draft.projects[0].name, "Painel de alertas");
  assert.match(draft.projects[0].description, /Aplicação para monitorar falhas/);
  assert.match(draft.projects[0].technologies, /TypeScript/);
  assert.match(draft.projects[0].technologies, /React/);
});

test("combina evidências separadas do nome e da descrição de um mesmo projeto", () => {
  const evidence = ["Painel de alertas", "Sistema web desenvolvido para acompanhar falhas com React."];
  const draft = mapResumeToDraft({
    extractedText: evidence.join("\n"),
    role: "",
    analysis: analysis({ projects: [{ name: "Painel de alertas", description: "descrição demonstrativa", technologies: [], evidence }] }),
  });
  assert.equal(draft.projects.length, 1);
  assert.equal(draft.projects[0].name, "Painel de alertas");
  assert.match(draft.projects[0].description, /Sistema web desenvolvido/);
});

test("não transforma a linha isolada Link repositório em projeto", () => {
  for (const evidence of ["Link repositório", "Link repositório: https://github.com/exemplo/projeto"]) {
    const draft = mapResumeToDraft({
      extractedText: evidence,
      role: "",
      analysis: analysis({ projects: [{ name: null, description: "Referência", technologies: [], evidence: [evidence] }] }),
    });
    assert.deepEqual(draft.projects, []);
  }
});

test("transfere link de repositório somente quando acompanha um projeto identificado", () => {
  const evidence = ["Projeto: Agenda Verde — Aplicação para organizar hortas.", "Link repositório: https://github.com/exemplo/agenda-verde"];
  const draft = mapResumeToDraft({
    extractedText: evidence.join("\n"),
    role: "",
    analysis: analysis({ projects: [{ name: "Agenda Verde", description: "descrição", technologies: [], evidence }] }),
  });
  assert.equal(draft.projects.length, 1);
  assert.equal(draft.projects[0].link, "https://github.com/exemplo/agenda-verde");
});

test("não cria experiência profissional quando não há evidência de emprego ou atividade equivalente", () => {
  const draft = mapResumeToDraft({
    extractedText: "Projeto pessoal: Aplicativo acadêmico para organização de estudos.",
    role: "",
    analysis: analysis({ projects: [{ name: "Aplicativo acadêmico", description: "Descrição.", technologies: [], evidence: ["Projeto pessoal: Aplicativo acadêmico para organização de estudos."] }] }),
  });
  assert.deepEqual(draft.experiences, []);
});

test("não infere habilidades nem tecnologias a partir de projeto", () => {
  const evidence = "Projeto: React Dashboard — Aplicação pessoal para organizar estudos.";
  const draft = mapResumeToDraft({
    extractedText: evidence,
    role: "",
    analysis: analysis({ projects: [{ name: "React Dashboard", description: "Descrição.", technologies: [], evidence: [evidence] }] }),
  });
  assert.deepEqual(draft.skills, []);
  assert.equal(draft.projects[0].technologies, "");
});

test("mantém vazios os dados pessoais e seções sem informação correspondente", () => {
  const draft = mapResumeToDraft({ extractedText: "", role: "", analysis: analysis() });
  assert.deepEqual(draft.personalInfo, {
    fullName: "", cityState: "", email: "", phone: "", linkedinUrl: "", githubPortfolioUrl: "",
  });
  assert.equal(draft.summary, "");
  assert.deepEqual(draft.education, []);
  assert.deepEqual(draft.projects, []);
  assert.deepEqual(draft.experiences, []);
  assert.deepEqual(draft.skills, []);
  assert.deepEqual(draft.languages, []);
  assert.deepEqual(draft.certifications, []);
});

test("transfere somente dados pessoais rotulados e localização Cidade/Estado sem endereço", () => {
  const draft = mapResumeToDraft({
    extractedText: "Nome: Joana Silva\nCidade/Estado: Campinas, SP\nE-mail: joana@example.com\nTelefone: (11) 90000-0000\nLinkedIn: https://linkedin.com/in/joana\nGitHub: https://github.com/joana\nEndereço: Rua Central, 123, Campinas, SP",
    role: "",
    analysis: analysis(),
  });
  assert.equal(draft.personalInfo.fullName, "Joana Silva");
  assert.equal(draft.personalInfo.cityState, "Campinas, SP");
  assert.equal(draft.personalInfo.email, "joana@example.com");
  assert.equal(draft.personalInfo.phone, "(11) 90000-0000");
  assert.equal(draft.personalInfo.linkedinUrl, "https://linkedin.com/in/joana");
  assert.equal(draft.personalInfo.githubPortfolioUrl, "https://github.com/joana");
  assert.doesNotMatch(draft.personalInfo.cityState, /Rua|123/);
});

test("transfere idioma e nível que aparecem juntos explicitamente", () => {
  const draft = mapResumeToDraft({
    extractedText: "Idiomas: Inglês intermediário; Espanhol básico",
    role: "",
    analysis: analysis(),
  });
  assert.deepEqual(draft.languages.map(({ name, proficiency }) => ({ name, proficiency })), [
    { name: "Inglês", proficiency: "intermediário" },
    { name: "Espanhol", proficiency: "básico" },
  ]);
});

test("reconhece idioma e nível em texto sem acentos", () => {
  const draft = mapResumeToDraft({ extractedText: "IDIOMAS: Ingles intermediario", role: "", analysis: analysis() });
  assert.deepEqual(draft.languages.map(({ name, proficiency }) => ({ name, proficiency })), [
    { name: "Ingles", proficiency: "intermediario" },
  ]);
});

test("reconhece dados equivalentes em um currículo escrito em inglês", () => {
  const draft = mapResumeToDraft({
    extractedText: "Name: Jane Silva\nCity/State: Austin, TX\nPhone: +1 512-555-0100\nLanguages: English intermediate",
    role: "",
    analysis: analysis(),
  });
  assert.equal(draft.personalInfo.fullName, "Jane Silva");
  assert.equal(draft.personalInfo.cityState, "Austin, TX");
  assert.equal(draft.personalInfo.phone, "+1 512-555-0100");
  assert.deepEqual(draft.languages.map(({ name, proficiency }) => ({ name, proficiency })), [
    { name: "English", proficiency: "intermediate" },
  ]);
});

test("transfere experiência apenas com evidência profissional explícita", () => {
  const evidence = "Desenvolvedora na Acme, 03/2022–11/2025. Construí APIs para o produto.";
  const draft = mapResumeToDraft({
    extractedText: `EXPERIÊNCIA PROFISSIONAL\n${evidence}`,
    role: "",
    analysis: analysis({ experiences: [{ company: null, role: null, period: null, summary: "descrição", evidence: [evidence] }] }),
  });
  assert.equal(draft.experiences.length, 1);
  assert.equal(draft.experiences[0].company, "Acme");
  assert.equal(draft.experiences[0].position, "Desenvolvedora");
  assert.equal(draft.experiences[0].startDate, "2022-03");
  assert.equal(draft.experiences[0].endDate, "2025-11");
});

test("combina cargo, empresa e período de evidências da mesma experiência", () => {
  const evidence = ["Cargo: Desenvolvedora", "Empresa: Acme", "Período: 03/2022–11/2025", "Construí APIs para o produto."];
  const draft = mapResumeToDraft({
    extractedText: `Experiência profissional\n${evidence.join("\n")}`,
    role: "",
    analysis: analysis({ experiences: [{ company: "Acme", role: "Desenvolvedora", period: null, summary: "descrição", evidence }] }),
  });
  assert.equal(draft.experiences.length, 1);
  assert.equal(draft.experiences[0].position, "Desenvolvedora");
  assert.equal(draft.experiences[0].company, "Acme");
  assert.equal(draft.experiences[0].startDate, "2022-03");
  assert.equal(draft.experiences[0].endDate, "2025-11");
});

test("transfere somente anos explícitos em datas acadêmicas sem completar mês", () => {
  const evidence = "Curso: Ciência da Computação; início: 2021; conclusão prevista: 2025; status: cursando; instituição: Universidade Exemplo";
  const draft = mapResumeToDraft({
    extractedText: evidence,
    role: "",
    analysis: analysis({ education: [{ name: evidence, institution: null, period: null, evidence: [evidence] }] }),
  });
  assert.equal(draft.education[0].startDate, "2021");
  assert.equal(draft.education[0].completionDate, "2025");
});

test("o editor aceita ano isolado nos campos de data do currículo", async () => {
  const source = await readFile(new URL("../features/resume/components/resume-editor.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /type="month"/);
});

test("/curriculo continua sem valor inicial quando o contexto está vazio", async () => {
  const source = await readFile(new URL("../features/resume/components/resume-builder-from-context.tsx", import.meta.url), "utf8");
  assert.match(source, /useState\(\(\) => draft \?\? undefined\)/);
  assert.match(source, /initialValue=\{initialValue\}/);
  assert.match(source, /useResumeDraft/);
});

test("o provider não usa persistência do navegador", async () => {
  const source = await readFile(new URL("../features/resume/resume-draft-context.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|cookies/i);
});

test("o CTA e o mapeador não fazem chamadas externas", async () => {
  const workspace = await readFile(new URL("../components/resume-analysis-workspace.tsx", import.meta.url), "utf8");
  const mapper = await readFile(new URL("../features/resume/transfer.ts", import.meta.url), "utf8");
  const cta = workspace.slice(workspace.indexOf("function AnalysisResults"), workspace.indexOf("function ResultList"));
  assert.doesNotMatch(cta, /fetch\s*\(|XMLHttpRequest|\/api\//);
  assert.doesNotMatch(mapper, /fetch\s*\(|XMLHttpRequest|\/api\//);
});
