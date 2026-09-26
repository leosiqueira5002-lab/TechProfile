import type { AnalysisResult } from "./contracts.ts";

export function getCurriculumCtaCopy(result: Pick<AnalysisResult, "education" | "projects">): string {
  const hasEducation = result.education.length > 0;
  const hasProjects = result.projects.length > 0;

  if (hasEducation && hasProjects) {
    return "Encontramos sua formação e projetos. Podemos transformar essas informações em uma apresentação profissional mais clara.";
  }
  if (hasEducation) {
    return "Encontramos informações de formação no seu currículo. Você pode organizá-las em uma apresentação profissional mais clara.";
  }
  if (hasProjects) {
    return "Encontramos projetos no seu currículo. Você pode apresentá-los de forma mais clara e direcionada ao cargo que procura.";
  }
  return "Encontramos informações importantes no seu currículo. Agora você pode reorganizá-las e apresentá-las de forma mais clara e direcionada ao cargo que procura.";
}
