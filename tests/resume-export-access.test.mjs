import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getResumeExportPresentation, runResumeExport } from "../features/resume/export-access.ts";
import { isProActive } from "../features/billing/access.ts";

const now = new Date("2026-09-29T12:00:00.000Z");

test("Free recebe exportação bloqueada e chamada para upgrade", () => {
  const access = getResumeExportPresentation(false, true);

  assert.equal(access.buttonLabel, "Disponível no Pro");
  assert.equal(access.buttonDisabled, false);
  assert.equal(access.showUpgradeCta, true);
});

test("Free não executa impressão e abre o caminho de upgrade", () => {
  let printCalls = 0;
  let upgradeCalls = 0;

  const result = runResumeExport({
    isPro: false,
    hasContent: true,
    print: () => { printCalls += 1; },
    onUpgrade: () => { upgradeCalls += 1; },
  });

  assert.equal(result, "upgrade");
  assert.equal(printCalls, 0);
  assert.equal(upgradeCalls, 1);
});

test("Pro com currículo preenchido executa a impressão", () => {
  let printCalls = 0;

  const result = runResumeExport({
    isPro: true,
    hasContent: true,
    print: () => { printCalls += 1; },
    onUpgrade: () => assert.fail("Pro não deve receber CTA de upgrade"),
  });

  assert.equal(result, "printed");
  assert.equal(printCalls, 1);
});

test("Pro expirado e profile ausente produzem estado Free", () => {
  const profiles = [
    { plan: "pro", pro_expires_at: "2026-09-29T11:59:59.999Z" },
    null,
    undefined,
  ];

  for (const profile of profiles) {
    assert.equal(isProActive(profile, now), false);
    assert.equal(getResumeExportPresentation(isProActive(profile, now), true).showUpgradeCta, true);
  }
});

test("estado vazio não permite imprimir mesmo para Pro", () => {
  let printCalls = 0;

  assert.equal(getResumeExportPresentation(true, false).buttonDisabled, true);
  assert.equal(runResumeExport({
    isPro: true,
    hasContent: false,
    print: () => { printCalls += 1; },
    onUpgrade: () => assert.fail("Currículo Pro vazio não deve abrir upgrade"),
  }), "empty");
  assert.equal(printCalls, 0);
});

test("módulos client-side do editor não contêm service role", async () => {
  const sources = await Promise.all([
    readFile(new URL("../features/resume/components/resume-builder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/resume/resume-draft-context.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal(sources.join("\n").toLowerCase().includes("service_role"), false);
  assert.equal(sources.join("\n").includes("SUPABASE_SERVICE_ROLE_KEY"), false);
});
