import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyMercadoPagoWebhookSignature } from "../features/billing/mercado-pago-signature.ts";

const secret = "fake-webhook-secret";
const dataId = "ABcd1234";
const requestId = "req_fake_123";
const timestamp = "1780000000";

function signatureFor(id = dataId, request = requestId, ts = timestamp) {
  const manifest = `${id ? `id:${id};` : ""}${request ? `request-id:${request};` : ""}ts:${ts};`;
  const hash = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

test("valida assinatura com os valores recebidos sem normalização local", () => {
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signatureFor(), requestId, dataId, secret }), true);
});

test("rejeita assinatura alterada, incompleta ou calculada para outro recurso", () => {
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: "", requestId, dataId, secret }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signatureFor().replace(/.$/, "0"), requestId, dataId, secret }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signatureFor(), requestId, dataId: "different-id", secret }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signatureFor(), requestId: "different-request", dataId, secret }), false);
});

test("aceita x-request-id ausente quando o manifest assinado pelo SDK o omite", () => {
  assert.equal(verifyMercadoPagoWebhookSignature({ signature: signatureFor(dataId, ""), requestId: null, dataId, secret }), true);
});

test("rejeita secret incorreta e data.id divergente", () => {
  const signature = signatureFor();
  assert.equal(verifyMercadoPagoWebhookSignature({ signature, requestId, dataId, secret: "wrong-secret" }), false);
  assert.equal(verifyMercadoPagoWebhookSignature({ signature, requestId, dataId: "another-id", secret }), false);
});
