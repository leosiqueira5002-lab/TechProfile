import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutAction } from "../features/billing/checkout-client.ts";

const checkoutUrl = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=demo";

function createResponse({ ok = true, payload = { checkoutUrl } } = {}) {
  return {
    ok,
    json: async () => payload,
  };
}

test("ação inicia checkout com POST sem enviar campos de pagamento", async () => {
  let request;
  const action = createCheckoutAction({
    fetchImpl: async (url, init) => { request = { url, init }; return createResponse(); },
    redirect: () => {},
    onLoadingChange: () => {},
    onError: () => {},
  });

  await action();

  assert.equal(request.url, "/api/checkout");
  assert.equal(request.init.method, "POST");
  assert.equal(Object.hasOwn(request.init, "body"), false);
  assert.equal(JSON.stringify(request.init).includes("amount"), false);
  assert.equal(JSON.stringify(request.init).includes("access_days"), false);
  assert.equal(JSON.stringify(request.init).includes("user_id"), false);
});

test("cliques repetidos enquanto o checkout carrega fazem uma única requisição", async () => {
  let resolveFetch;
  let fetchCalls = 0;
  const loadingStates = [];
  const action = createCheckoutAction({
    fetchImpl: () => {
      fetchCalls += 1;
      return new Promise((resolve) => { resolveFetch = resolve; });
    },
    redirect: () => {},
    onLoadingChange: (loading) => loadingStates.push(loading),
    onError: () => {},
  });

  const first = action();
  const second = action();
  assert.equal(fetchCalls, 1);
  resolveFetch(createResponse());
  await Promise.all([first, second]);

  assert.deepEqual(loadingStates, [true, false]);
});

test("redireciona para a URL de checkout retornada pelo servidor", async () => {
  let redirectedTo;
  const action = createCheckoutAction({
    fetchImpl: async () => createResponse(),
    redirect: (url) => { redirectedTo = url; },
    onLoadingChange: () => {},
    onError: () => {},
  });

  await action();

  assert.equal(redirectedTo, checkoutUrl);
});

test("erro ou resposta sem URL mostra mensagem amigável e não redireciona", async (t) => {
  for (const response of [createResponse({ ok: false }), createResponse({ payload: {} })]) {
    await t.test("resposta inválida", async () => {
      let errorMessage = "";
      let redirectCalls = 0;
      const action = createCheckoutAction({
        fetchImpl: async () => response,
        redirect: () => { redirectCalls += 1; },
        onLoadingChange: () => {},
        onError: (message) => { errorMessage = message; },
      });

      await action();

      assert.equal(errorMessage, "Não foi possível iniciar o pagamento. Tente novamente.");
      assert.equal(redirectCalls, 0);
    });
  }
});
