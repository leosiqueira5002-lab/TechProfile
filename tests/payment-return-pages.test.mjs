import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.PAYMENT_TEST_URL ?? "http://127.0.0.1:3000";

test("páginas de retorno mostram estados separados sem confiar na query string para liberar Pro", async () => {
  const success = await fetch(`${baseUrl}/pagamento/sucesso?status=approved&payment_id=987654321`);
  const pending = await fetch(`${baseUrl}/pagamento/pendente?status=approved`);
  const error = await fetch(`${baseUrl}/pagamento/erro?status=approved`);
  assert.equal(success.status, 200);
  assert.equal(pending.status, 200);
  assert.equal(error.status, 200);
  const [successText, pendingText, errorText] = await Promise.all([success.text(), pending.text(), error.text()]);
  assert.match(successText, /somente depois que o Mercado Pago confirmar/i);
  assert.match(pendingText, /Aguardando confirmação/);
  assert.match(errorText, /Nenhum acesso Pro foi liberado/);
});
