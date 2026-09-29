import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createCheckoutExternalReference } from "../features/billing/mercado-pago.ts";
import { createMercadoPagoWebhookHandler } from "../features/billing/mercado-pago-webhook.ts";
import { verifyMercadoPagoWebhookSignature } from "../features/billing/mercado-pago-signature.ts";

const env = {
  MERCADO_PAGO_ACCESS_TOKEN: "TEST-fake-token",
  MERCADO_PAGO_WEBHOOK_SECRET: "fake-webhook-secret",
  MERCADO_PAGO_MODE: "test",
  NEXT_PUBLIC_APP_URL: "https://tech-profile-12ql.vercel.app",
};
const userId = "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2";

function makeRequest({ dataId = "987654321", type = "payment", paymentId = dataId, signature = "valid" } = {}) {
  return new Request(`https://app.test/api/webhooks/mercado-pago?data.id=${dataId}&type=${type}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": signature, "x-request-id": "req_fake" },
    body: JSON.stringify({ type, data: { id: paymentId } }),
  });
}

function payment(overrides = {}) {
  return {
    id: "987654321",
    status: "approved",
    currency_id: "BRL",
    transaction_amount: 19.9,
    external_reference: createCheckoutExternalReference(userId, env.MERCADO_PAGO_WEBHOOK_SECRET),
    live_mode: false,
    ...overrides,
  };
}

function tamperedReference(forUserId = userId) {
  const reference = createCheckoutExternalReference(forUserId, env.MERCADO_PAGO_WEBHOOK_SECRET);
  const replacement = reference.endsWith("0") ? "1" : "0";
  return `${reference.slice(0, -1)}${replacement}`;
}

test("webhook inválido não consulta pagamento nem grava dados", async () => {
  let lookups = 0;
  let writes = 0;
  const logs = [];
  const handler = createMercadoPagoWebhookHandler({
    env,
    verifySignature: verifyMercadoPagoWebhookSignature,
    getPayment: async () => { lookups += 1; return payment(); },
    applyPayment: async () => { writes += 1; return "granted"; },
    log: (event, metadata) => logs.push({ event, metadata }),
  });
  const response = await handler(makeRequest({ signature: "invalid" }));
  assert.equal(response.status, 401);
  assert.equal(lookups, 0);
  assert.equal(writes, 0);
  assert.deepEqual(logs[0], {
    event: "received",
    metadata: { type: "payment", action: null, hasSignature: true, hasRequestId: true, hasDataId: true },
  });
  assert.equal(JSON.stringify(logs).includes("987654321"), false);
  assert.equal(JSON.stringify(logs).includes(env.MERCADO_PAGO_WEBHOOK_SECRET), false);
});

test("body.data.id nunca substitui o data.id ausente da query", async () => {
  const dataId = "987654321";
  const requestId = "req_fake";
  const timestamp = "1780000000";
  const manifest = `request-id:${requestId};ts:${timestamp};`;
  const hash = createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
  const request = new Request("https://app.test/api/webhooks/mercado-pago?type=payment", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": `ts=${timestamp},v1=${hash}`, "x-request-id": requestId },
    body: JSON.stringify({ type: "payment", data: { id: dataId } }),
  });
  let lookups = 0;
  let writes = 0;
  const response = await createMercadoPagoWebhookHandler({
    env,
    verifySignature: verifyMercadoPagoWebhookSignature,
    getPayment: async () => { lookups += 1; return payment(); },
    applyPayment: async () => { writes += 1; return "granted"; },
    log: () => {},
  })(request);

  assert.equal(response.status, 400);
  assert.equal(lookups, 0);
  assert.equal(writes, 0);
});

test("notificação IPN merchant_order sem assinatura é rejeitada e não concede Pro", async () => {
  let signatureChecks = 0;
  let lookups = 0;
  let grants = 0;
  const handler = createMercadoPagoWebhookHandler({
    env,
    verifySignature: (input) => { signatureChecks += 1; return verifyMercadoPagoWebhookSignature(input); },
    getPayment: async () => { lookups += 1; return payment(); },
    applyPayment: async () => { grants += 1; return "granted"; },
  });
  const response = await handler(new Request(
    "https://app.test/api/webhooks/mercado-pago?topic=merchant_order&id=123456",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "123456" }) },
  ));

  assert.equal(response.status, 401);
  assert.equal(signatureChecks, 1);
  assert.equal(lookups, 0);
  assert.equal(grants, 0);
});

test("webhook pending e rejected são persistidos sem conceder Pro", async (t) => {
  for (const status of ["pending", "rejected"]) {
    await t.test(status, async () => {
      let processed;
      const handler = createMercadoPagoWebhookHandler({
        env,
        verifySignature: () => true,
        getPayment: async () => payment({ status }),
        applyPayment: async (value) => { processed = value; return "not-approved"; },
      });
      const response = await handler(makeRequest());
      assert.equal(response.status, 200);
      assert.equal(processed.status, status);
      assert.equal(processed.accessDays, 30);
    });
  }
});

test("pagamento aprovado verificado é entregue à gravação transacional", async () => {
  let processed;
  const handler = createMercadoPagoWebhookHandler({
    env,
    verifySignature: () => true,
    getPayment: async () => payment(),
    applyPayment: async (value) => { processed = value; return "granted"; },
  });
  const response = await handler(makeRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(processed, {
    providerPaymentId: "987654321",
    userId,
    amount: 19.9,
    currency: "BRL",
    status: "approved",
    accessDays: 30,
  });
});

test("amount, currency, external_reference, modo e ID divergentes não gravam", async (t) => {
  const cases = [
    ["amount", payment({ transaction_amount: 2 })],
    ["currency", payment({ currency_id: "USD" })],
    ["reference", payment({ external_reference: tamperedReference("c7a950c6-7baf-4d5c-a164-d3d3c05fc7d3") })],
    ["mode", payment({ live_mode: true })],
    ["id", payment({ id: "111111111" })],
  ];
  for (const [label, actualPayment] of cases) {
    await t.test(label, async () => {
      let writes = 0;
      const handler = createMercadoPagoWebhookHandler({
        env,
        verifySignature: () => true,
        getPayment: async () => actualPayment,
        applyPayment: async () => { writes += 1; return "granted"; },
      });
      const response = await handler(makeRequest());
      assert.equal(response.status, 200);
      assert.equal(writes, 0);
    });
  }
});

test("external_reference adulterada e data.id divergente no body são rejeitados", async (t) => {
  await t.test("HMAC da reference adulterado", async () => {
    let writes = 0;
    const handler = createMercadoPagoWebhookHandler({
      env,
      verifySignature: () => true,
      getPayment: async () => payment({ external_reference: tamperedReference() }),
      applyPayment: async () => { writes += 1; return "granted"; },
    });
    await handler(makeRequest());
    assert.equal(writes, 0);
  });
  await t.test("body/query mismatch", async () => {
    let lookups = 0;
    const handler = createMercadoPagoWebhookHandler({
      env,
      verifySignature: () => true,
      getPayment: async () => { lookups += 1; return payment(); },
      applyPayment: async () => "granted",
    });
    const response = await handler(makeRequest({ paymentId: "123456789" }));
    assert.equal(response.status, 400);
    assert.equal(lookups, 0);
  });
});

test("falha temporária do banco retorna 503 para permitir retry sem vazar detalhes", async () => {
  const handler = createMercadoPagoWebhookHandler({
    env,
    verifySignature: () => true,
    getPayment: async () => payment(),
    applyPayment: async () => { throw new Error("private database details"); },
  });
  const response = await handler(makeRequest());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database details/);
});
