import {
  AnalysisResultSchema,
  redactResumeText,
  validateEvidence,
  type AnalysisInput,
  type AnalysisResult,
} from "../contracts.ts";
import type { AnalysisProvider } from "./types.ts";
import { AnalysisProviderError } from "./types.ts";

type SectionKey = "summary" | "experience" | "projects" | "education" | "certifications";
type ResumeSection = { key: SectionKey; label: string; index: number; line: string };

const HEADINGS: Array<{ key: SectionKey; label: string; pattern: RegExp }> = [
  { key: "summary", label: "Resumo profissional", pattern: /^(?:resumo(?:\s+profissional)?|perfil(?:\s+profissional)?|objetivo\s+profissional|professional\s+summary|summary)$/i },
  { key: "experience", label: "Experiência profissional", pattern: /^(?:experi[eê]ncias?(?:\s+profission(?:al|ais))?|hist[óo]rico\s+profissional|professional\s+experience|work\s+experience|experience)$/i },
  { key: "projects", label: "Projetos", pattern: /^(?:projetos?|projects?)$/i },
  { key: "education", label: "Formação", pattern: /^(?:forma[cç][ãa]o(?:\s+acad[eê]mica)?|educa[cç][ãa]o|academic\s+background|education)$/i },
  { key: "certifications", label: "Certificações", pattern: /^(?:certifica[cç][õo]es?|certifications?|licen[cç]as?)$/i },
];

const TECHNOLOGIES = [
  "TypeScript", "JavaScript", "Node.js", "PostgreSQL", "MySQL", "MongoDB", "Kubernetes", "Terraform",
  "GitHub Actions", "Power BI", "scikit-learn", "TensorFlow", "Playwright", "Selenium", "GraphQL",
  "React", "Next.js", "Vue.js", "Angular", "Python", "Django", "Flask", "Java", "Spring", "C#",
  ".NET", "PHP", "Laravel", "Ruby", "Rails", "Rust", "Kotlin", "Swift", "Redis", "Docker", "AWS",
  "Azure", "Linux", "Git", "Jest", "Cypress", "HTML", "CSS", "Tableau", "Pandas", "PyTorch", "SQL",
];

const EXPERIENCE_CUES = /\b(?:trabalhei|trabalhou|atuei|atuou|estagi[aá]ri[oa]|est[aá]gio|freelancer|freelance|contratad[oa]|empregad[oa]|experi[eê]ncia profissional)\b/i;
const PROJECT_CUES = /\b(?:lista projetos?|projeto(?:s)?(?:\s+(?:publicado|pessoal|acad[eê]mico|universit[aá]rio))?|reposit[oó]rio(?:s)?|site|sistema|aplica[cç][ãa]o|aplicativo|plataforma|desenvolv(?:i|id)[oa]s?)\b/i;
const EDUCATION_CUES = /\b(?:universidade|universit[aá]ri[oa]|faculdade|gradua[cç][ãa]o|curso|forma[cç][ãa]o acad[eê]mica|engenharia de software|ci[eê]ncia da computa[cç][ãa]o|sistemas? (?:de informa[cç][ãa]o|para internet)|an[aá]lise e desenvolvimento de sistemas|tecn[oó]logo|tecnologia em|bacharelado|licenciatura)\b/i;
const EDUCATION_CONTEXT = /\b(?:cursando|cursada|per[ií]odo|semestre|universidade|faculdade|\b(?:20\d{2})\b)\b/i;
const LANGUAGE_CUES = /\b(?:portugu[eê]s|ingl[eê]s|espanhol|franc[eê]s|alem[aã]o|italiano|mandarim|japon[eê]s|l[ií]ngua brasileira de sinais|libras)\b/i;
const LANGUAGE_LEVEL = /\b(?:b[aá]sico|b[aá]sica|intermedi[aá]rio|intermedi[aá]ria|avan[cç]ado|avan[cç]ada|fluente|nativo|nativa|b[12]|a[12]|c[12])\b/i;
const SUMMARY_CUES = /\b(?:profissional|desenvolvedor[\w]*|engenheir[\w]*|analista|especialista|experi[eê]ncia|atua[cç][ãa]o|carreira|objetivo)\b/i;
const SECTION_RECOMMENDATIONS = {
  experience: ["Experiência", "experiência profissional"],
  technologies: ["Tecnologias", "tecnologias ou competências técnicas"],
  projects: ["Projetos", "projetos"],
  clarity: ["Resumo profissional", "um resumo profissional"],
  positioning: ["Posicionamento", "seu cargo desejado"],
} as const;

export const demoAnalysisProvider: AnalysisProvider = {
  mode: "demo",
  async analyze(input) {
    return buildDemoAnalysis(input);
  },
};

export function buildDemoAnalysis(input: AnalysisInput): AnalysisResult {
  const source = redactForDemo(input.extractedText);
  if (source.length < 80 || source.split(/\s+/).filter(Boolean).length < 12) {
    throw new AnalysisProviderError("insufficient_text");
  }

  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const safeLines = lines.filter((line) => !/\[(?:EMAIL|TELEFONE|ENDERE[CÇ]O) REMOVIDO\]/i.test(line));
  const sections = detectSections(safeLines);
  const technologies = detectTechnologies(safeLines.join("\n"));
  const education = detectEducation(safeLines, sections);
  const projects = detectProjects(safeLines, sections);
  const experiences = detectExperiences(safeLines, sections);
  const links = detectLinks(safeLines);
  const languages = detectLanguages(safeLines);
  const summarySection = sections.find((section) => section.key === "summary");
  const summaryBody = summarySection && safeLines.slice(summarySection.index + 1).find((line) => SUMMARY_CUES.test(line));
  const roleMatch = findLiteral(source, input.role);

  const safeFactEvidence = [
    ...education.flatMap((item) => item.evidence),
    ...projects.flatMap((item) => item.evidence),
    ...experiences.flatMap((item) => item.evidence),
    ...technologies.flatMap((item) => item.evidence),
    ...links.flatMap((item) => item.evidence),
    ...languages.flatMap((item) => item.evidence),
    ...sections.map((section) => section.line),
  ];
  const summaryEvidence = unique(safeFactEvidence).slice(0, 8);
  if (summaryEvidence.length === 0) {
    summaryEvidence.push(safeLines.find((line) => !isLikelyContactLine(line)) ?? "[TEXTO DO CURRÍCULO ANALISADO]");
  }
  const summaryText = summaryBody
    ? "Foi identificado conteúdo sob um título de resumo profissional. O modo demo não avalia a qualidade desse texto."
    : "Não foi identificado um resumo profissional explícito no currículo. Você pode criar um resumo posteriormente, se fizer sentido para seu objetivo.";

  const categories: AnalysisResult["categories"] = {
    experience: experiences.length
      ? { status: "good", explanation: "Foram identificadas referências explícitas a atividade profissional no currículo enviado.", evidence: experiences[0].evidence.slice(0, 8) }
      : { status: "not_mentioned", explanation: "Experiência profissional não foi identificada claramente no currículo enviado. Isso não significa que você não tenha essa experiência.", evidence: [] },
    technologies: technologies.length
      ? { status: "good", explanation: "Foram localizadas menções literais a tecnologias no currículo enviado.", evidence: technologies.slice(0, 8).map((item) => item.evidence[0]) }
      : { status: "not_mentioned", explanation: "Não foram identificadas tecnologias da lista demonstrativa no currículo enviado. Isso não significa que você não conheça essas tecnologias.", evidence: [] },
    projects: projects.length
      ? { status: "good", explanation: "Foram encontradas descrições ou referências de projetos no conteúdo, mesmo sem depender de um título de seção específico.", evidence: projects.slice(0, 8).flatMap((item) => item.evidence).slice(0, 8) }
      : { status: "not_mentioned", explanation: "Não foram identificadas descrições de projetos no currículo enviado. Se você possui projetos, considere incluí-los.", evidence: [] },
    clarity: summaryBody
      ? { status: "good", explanation: "Foi identificado conteúdo sob um título de resumo profissional; a demo não avalia sua qualidade.", evidence: [summarySection!.line, summaryBody] }
      : { status: "not_mentioned", explanation: "Não foi identificado um resumo profissional explícito no conteúdo analisado.", evidence: [] },
    positioning: roleMatch
      ? { status: "good", explanation: "O cargo informado aparece literalmente no texto do currículo.", evidence: [roleMatch] }
      : { status: "not_mentioned", explanation: "O cargo desejado foi informado como contexto, mas não foi identificado explicitamente no conteúdo analisado.", evidence: [] },
  };

  const recommendations = (Object.keys(SECTION_RECOMMENDATIONS) as Array<keyof typeof SECTION_RECOMMENDATIONS>)
    .filter((key) => ({ experience: experiences.length, technologies: technologies.length, projects: projects.length, clarity: summaryBody ? 1 : 0, positioning: roleMatch ? 1 : 0 }[key]) === 0)
    .map((key) => {
      const [title, subject] = SECTION_RECOMMENDATIONS[key];
      return {
        title: `${title} (se aplicável)`,
        description: `Se você possui ${subject}, considere acrescentar essa informação ao currículo. Não identificar essa informação no documento não indica que ela não faça parte da sua trajetória.`,
        evidence: [],
      };
    });

  const strengths: AnalysisResult["strengths"] = [
    ...education.map((item) => ({ title: "Formação identificada", description: "O currículo menciona esta formação.", evidence: item.evidence })),
    ...projects.slice(0, 3).map((item) => ({ title: "Projeto identificado", description: item.description, evidence: item.evidence })),
    ...links.map((item) => ({ title: `${item.name} identificado`, description: item.description, evidence: item.evidence })),
    ...languages.map((item) => ({ title: "Idioma mencionado", description: "Idioma e nível reproduzidos conforme aparecem no currículo.", evidence: item.evidence })),
    ...technologies.slice(0, 3).map((item) => ({ title: `Menção a ${item.name}`, description: "A tecnologia aparece literalmente no texto extraído.", evidence: item.evidence })),
  ].slice(0, 8);

  const certificationsSection = sections.find((section) => section.key === "certifications");
  const certifications = certificationsSection
    ? safeLines.slice(certificationsSection.index + 1, nextSectionIndex(sections, certificationsSection.index, safeLines.length)).filter((line) => !isHeading(line)).slice(0, 3).map((line) => ({ name: line, issuer: null, period: null, evidence: [line] }))
    : [];
  const result = AnalysisResultSchema.parse({
    summary: { text: summaryText, evidence: summaryEvidence },
    strengths,
    improvements: recommendations,
    technologies,
    experiences,
    projects,
    education,
    certifications,
    categories,
    recommendations,
  });

  const validated = validateEvidence(result, source);
  if (!validated.success) throw new AnalysisProviderError("invalid_response");
  return validated.data;
}

function redactForDemo(input: string): string {
  const withPlatformLabels = input
    .replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/gi, "LinkedIn")
    .replace(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)]+/gi, "GitHub")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[LINK REMOVIDO]");
  return redactResumeText(withPlatformLabels);
}

function detectSections(lines: string[]): ResumeSection[] {
  return lines.flatMap((line, index) => {
    const heading = HEADINGS.find((item) => item.pattern.test(line));
    return heading ? [{ key: heading.key, label: heading.label, index, line }] : [];
  });
}

function detectEducation(lines: string[], sections: ResumeSection[]) {
  const section = sections.find((item) => item.key === "education");
  const content = section ? lines.slice(section.index + 1, nextSectionIndex(sections, section.index, lines.length)) : lines;
  const candidates = content.flatMap((line, index) => EDUCATION_CUES.test(line) ? [{ line, index }] : []);
  if (!candidates.length) return [];

  const course = candidates.find(({ line }) => /engenharia|ci[eê]ncia|sistemas?|gradua[cç][ãa]o|bacharelado|licenciatura|tecn[oó]logo|curso/i.test(line)) ?? candidates[0];
  const evidence = unique([
    course.line,
    ...content.slice(Math.max(0, course.index - 1), course.index + 3).filter((line) => line !== course.line && (EDUCATION_CUES.test(line) || EDUCATION_CONTEXT.test(line))),
  ]).slice(0, 8);
  return [{ name: course.line, institution: null, period: null, evidence }];
}

function detectProjects(lines: string[], sections: ResumeSection[]) {
  const section = sections.find((item) => item.key === "projects");
  const content = section ? lines.slice(section.index + 1, nextSectionIndex(sections, section.index, lines.length)) : lines;
  const candidates = content.filter((line) => PROJECT_CUES.test(line) && !/^(?:projetos?|lista projetos?)\s*[:\-]?$/i.test(line));
  return unique(candidates).slice(0, 20).map((line) => {
    const labeled = /^(?:lista projetos?|projeto(?:\s+publicado)?|projeto pessoal|reposit[oó]rio)\s*[:\-]\s*(.+)$/i.exec(line);
    const nameCandidate = labeled?.[1]?.split(/\s+[—–|:]\s+|\s+-\s+/)[0]?.trim();
    const name = nameCandidate && nameCandidate.length <= 160 && findLiteral(line, nameCandidate) ? nameCandidate : null;
    return {
      name,
      description: "O currículo contém esta descrição ou referência de projeto; a demo não infere resultados ou qualidade técnica.",
      technologies: [],
      evidence: [line],
    };
  });
}

function detectExperiences(lines: string[], sections: ResumeSection[]) {
  const section = sections.find((item) => item.key === "experience");
  const content = section ? lines.slice(section.index + 1, nextSectionIndex(sections, section.index, lines.length)) : lines;
  const explicit = content.filter((line) => EXPERIENCE_CUES.test(line) && !/projeto[s]? (?:acad[eê]mico|pessoal|universit[aá]rio)/i.test(line));
  const sectionDetails = section && explicit.length === 0
    ? content.filter((line) => line.length > 20 && !PROJECT_CUES.test(line) && !isLikelyContactLine(line)).slice(0, 3)
    : [];
  return unique(explicit.length ? explicit : sectionDetails)
    .slice(0, 20)
    .map((line) => ({ company: null, role: null, period: null, summary: "O currículo descreve esta atividade profissional. A demo não infere empresa, cargo ou duração.", evidence: [line] }));
}

function detectLinks(lines: string[]) {
  const findings: Array<{ name: string; description: string; evidence: string[] }> = [];
  for (const line of lines) {
    if (/\bLinkedIn\b/i.test(line)) findings.push({ name: "LinkedIn", description: "O currículo contém uma referência ou link do LinkedIn; o endereço foi ocultado.", evidence: [line] });
    if (/\bGitHub\b|\breposit[oó]rio\b/i.test(line)) findings.push({ name: "GitHub/repositório", description: "O currículo contém uma referência a GitHub ou repositório; o endereço foi ocultado.", evidence: [line] });
  }
  return uniqueBy(findings, (item) => `${item.name}:${item.evidence[0]}`).slice(0, 8);
}

function detectLanguages(lines: string[]) {
  return unique(lines.filter((line) => LANGUAGE_CUES.test(line) && LANGUAGE_LEVEL.test(line))).slice(0, 8)
    .map((line) => ({ title: "Idioma mencionado", description: "Idioma e nível reproduzidos conforme aparecem no currículo.", evidence: [line] }));
}

function detectTechnologies(source: string): AnalysisResult["technologies"] {
  return TECHNOLOGIES.flatMap((name) => {
    const match = findLiteral(source, name);
    return match ? [{ name: match, context: "Menção literal encontrada no texto extraído.", evidence: [match] }] : [];
  }).sort((left, right) => source.toLocaleLowerCase().indexOf(left.name.toLocaleLowerCase()) - source.toLocaleLowerCase().indexOf(right.name.toLocaleLowerCase()));
}

function findLiteral(source: string, value: string): string | undefined {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").exec(source);
  return match?.[0];
}

function nextSectionIndex(sections: ResumeSection[], currentIndex: number, fallback: number): number {
  return sections.find((section) => section.index > currentIndex)?.index ?? fallback;
}

function isHeading(line: string): boolean {
  return HEADINGS.some((item) => item.pattern.test(line));
}

function isLikelyContactLine(line: string): boolean {
  return /(?:\[LINK REMOVIDO\]|\b(?:telefone|celular|email|e-mail|endereço|address|rua|avenida|av\.|travessa|rodovia|cep)\b|\b\d{5}-?\d{3}\b)/i.test(line);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
