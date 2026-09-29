import assert from "node:assert/strict";
import test from "node:test";
import { getBillingPresentation } from "../features/billing/presentation.ts";

const now = new Date("2026-09-29T12:00:00.000Z");

test("Free mostra badge Free e ação Assinar Pro", () => {
  assert.deepEqual(getBillingPresentation({ plan: "free", pro_expires_at: null }, now), {
    badgeLabel: "Free",
    showSubscribe: true,
    validUntilLabel: null,
  });
});

test("Pro ativo oculta Assinar Pro e mostra validade formatada", () => {
  assert.deepEqual(getBillingPresentation({ plan: "pro", pro_expires_at: "2026-10-29T10:55:38.453Z" }, now), {
    badgeLabel: "Pro",
    showSubscribe: false,
    validUntilLabel: "29/10/2026",
  });
});

test("Pro expirado e profile ausente são apresentados com segurança como Free", () => {
  for (const profile of [
    { plan: "pro", pro_expires_at: "2026-09-29T11:59:59.999Z" },
    null,
    undefined,
  ]) {
    assert.deepEqual(getBillingPresentation(profile, now), {
      badgeLabel: "Free",
      showSubscribe: true,
      validUntilLabel: null,
    });
  }
});
