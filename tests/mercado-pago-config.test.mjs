import assert from "node:assert/strict";
import test from "node:test";
import { getMercadoPagoConfig, createMercadoPagoPreference, createCheckoutExternalReference, getMercadoPagoPayment, verifyCheckoutExternalReference } from "../features/billing/mercado-pago.ts";

const env = {
  MERCADO_PAGO_ACCESS_TOKEN: "TEST-fake-access-token",
  MERCADO_PAGO_MODE: "test",
  MERCADO_PAGO_WEBHOOK_SECRET: "fake-webhook-secret",
  NEXT_PUBLIC_APP_URL: "https://tech-profile-12ql.vercel.app",
};

test("exige configuração de teste e URL pública HTTPS sem localhost", () => {
  assert.equal(getMercadoPagoConfig(env).mode, "test");
  assert.throws(() => getMercadoPagoConfig({ ...env, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), /HTTPS pública/);
  assert.throws(() => getMercadoPagoConfig({ ...env, MERCADO_PAGO_MODE: "live" }), /MERCADO_PAGO_MODE/);
});

test("preferência ignora valores do cliente e usa preço BRL fixo e 30 dias", async () => {
  let request;
  const result = await createMercadoPagoPreference({
    userId: "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2",
    env,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json({ id: "pref_fake", sandbox_init_point: "https://sandbox.mercadopago.com.br/pay" });
    },
  });

  assert.equal(result.checkoutUrl, "https://sandbox.mercadopago.com.br/pay");
  assert.equal(request.url, "https://api.mercadopago.com/checkout/preferences");
  assert.equal(request.init.headers.authorization, "Bearer TEST-fake-access-token");
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.items, [{ title: "TechProfile Pro", description: "Acesso por 30 dias", quantity: 1, currency_id: "BRL", unit_price: 19.9 }]);
  assert.equal(body.external_reference, createCheckoutExternalReference("c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2", env.MERCADO_PAGO_WEBHOOK_SECRET));
  assert.equal(verifyCheckoutExternalReference(body.external_reference, env.MERCADO_PAGO_WEBHOOK_SECRET), "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2");
  assert.deepEqual(body.back_urls, {
    success: "https://tech-profile-12ql.vercel.app/pagamento/sucesso",
    pending: "https://tech-profile-12ql.vercel.app/pagamento/pendente",
    failure: "https://tech-profile-12ql.vercel.app/pagamento/erro",
  });
  assert.equal(body.notification_url, "https://tech-profile-12ql.vercel.app/api/webhooks/mercado-pago");
  assert.equal(body.auto_return, "approved");
});

test("checkout production usa somente init_point", async () => {
  const productionEnv = { ...env, MERCADO_PAGO_MODE: "production", MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-fake" };
  const result = await createMercadoPagoPreference({
    userId: "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2",
    env: productionEnv,
    fetchImpl: async () => Response.json({ init_point: "https://www.mercadopago.com.br/live", sandbox_init_point: "https://sandbox.mercadopago.com.br/sandbox" }),
  });
  assert.equal(result.checkoutUrl, "https://www.mercadopago.com.br/live");
});

test("consulta pagamento usa token no servidor e retorna os campos verificados", async () => {
  let request;
  const payment = { id: 987654321, status: "approved", currency_id: "BRL", transaction_amount: 19.9, external_reference: "c7a950c6-7baf-4d5c-a164-d3d3c05fc7d2", live_mode: false };
  const result = await getMercadoPagoPayment("987654321", {
    env,
    fetchImpl: async (url, init) => { request = { url, init }; return Response.json(payment); },
  });
  assert.equal(request.url, "https://api.mercadopago.com/v1/payments/987654321");
  assert.equal(request.init.headers.authorization, "Bearer TEST-fake-access-token");
  assert.deepEqual(result, payment);
});
