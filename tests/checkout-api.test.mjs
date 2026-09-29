import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutHandler } from "../features/billing/checkout.ts";

const authenticatedId = "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2";

test("usuário não autenticado não cria checkout", async () => {
  let preferenceCalls = 0;
  const handler = createCheckoutHandler({
    getAuthenticatedUserId: async () => null,
    createPreference: async () => { preferenceCalls += 1; return { checkoutUrl: "https://mercadopago.test" }; },
  });

  const response = await handler(new Request("https://app.test/api/checkout", { method: "POST" }));
  assert.equal(response.status, 401);
  assert.equal(preferenceCalls, 0);
});

test("request não pode alterar preço, dias, usuário ou estado do pagamento", async () => {
  let preferenceUserId;
  const handler = createCheckoutHandler({
    getAuthenticatedUserId: async () => authenticatedId,
    createPreference: async (userId) => { preferenceUserId = userId; return { checkoutUrl: "https://www.mercadopago.com.br/checkout/fake" }; },
  });
  const response = await handler(new Request("https://app.test/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 0.01, access_days: 9000, user_id: "attacker", status: "approved", provider_payment_id: "fake" }),
  }));

  assert.equal(response.status, 200);
  assert.equal(preferenceUserId, authenticatedId);
  assert.deepEqual(await response.json(), { checkoutUrl: "https://www.mercadopago.com.br/checkout/fake" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("erro do provedor é neutralizado sem vazar mensagem interna", async () => {
  const handler = createCheckoutHandler({
    getAuthenticatedUserId: async () => authenticatedId,
    createPreference: async () => { throw new Error("Bearer secret token response body"); },
  });
  const response = await handler(new Request("https://app.test/api/checkout", { method: "POST" }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret token response body/);
});
