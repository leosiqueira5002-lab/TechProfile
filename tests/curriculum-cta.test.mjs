import assert from "node:assert/strict";
import { test } from "node:test";
import { getCurriculumCtaCopy } from "../features/analysis/curriculum-cta.ts";

test("CTA cita somente informações identificadas na análise", () => {
  const copy = getCurriculumCtaCopy({ education: [{ name: "Engenharia de Software" }], projects: [{ name: "Projeto A" }] });
  assert.equal(copy, "Encontramos sua formação e projetos. Podemos transformar essas informações em uma apresentação profissional mais clara.");
});

test("CTA usa texto genérico quando a análise não identificou formação ou projetos", () => {
  const copy = getCurriculumCtaCopy({ education: [], projects: [] });
  assert.equal(copy, "Encontramos informações importantes no seu currículo. Agora você pode reorganizá-las e apresentá-las de forma mais clara e direcionada ao cargo que procura.");
});
