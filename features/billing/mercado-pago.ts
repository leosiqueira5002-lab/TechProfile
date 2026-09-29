import { isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";

export const TECHPROFILE_PRO = {
  title: "TechProfile Pro",
  amount: 19.9,
  currency: "BRL",
  quantity: 1,
  accessDays: 30,
} as const;

type Environment = Record<string, string | undefined>;
type Fetch = typeof fetch;

export type MercadoPagoMode = "test" | "production";

export type VerifiedPaymentPayload = {
  id: string | number;
  status: string;
  currency_id: string;
  transaction_amount: number;
  external_reference: string | null;
};

export class MercadoPagoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export function createCheckoutExternalReference(userId: string, secret: string): string {
  if (!secret) throw new MercadoPagoError("A verificação segura do checkout não está configurada.");
  const normalizedUserId = userId.toLowerCase();
  const digest = createHmac("sha256", secret)
    .update(`techprofile-checkout-v1:${normalizedUserId}`)
    .digest("hex");
  return `tp1:${normalizedUserId}:${digest}`;
}

export function verifyCheckoutExternalReference(reference: string | null, secret: string): string | null {
  if (!reference || !secret) return null;
  const [version, userId, digest, ...extra] = reference.split(":");
  if (version !== "tp1" || extra.length || !userId || !digest || !/^[a-f\d]{64}$/i.test(digest)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return null;

  const expected = Buffer.from(createCheckoutExternalReference(userId, secret).split(":")[2], "hex");
  const received = Buffer.from(digest, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received) ? userId.toLowerCase() : null;
}

export function getMercadoPagoConfig(env: Environment = process.env) {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  const mode = env.MERCADO_PAGO_MODE?.trim();
  const rawAppUrl = env.NEXT_PUBLIC_APP_URL?.trim();

  if (!accessToken) throw new MercadoPagoError("Mercado Pago não está configurado.");
  if (mode !== "test" && mode !== "production") {
    throw new MercadoPagoError("MERCADO_PAGO_MODE precisa ser test ou production.");
  }
  if (!rawAppUrl) throw new MercadoPagoError("A URL pública da aplicação não está configurada.");

  let appUrl: URL;
  try {
    appUrl = new URL(rawAppUrl);
  } catch {
    throw new MercadoPagoError("A URL pública da aplicação é inválida.");
  }

  const hostname = appUrl.hostname.toLowerCase();
  const ipVersion = isIP(hostname);
  if (
    appUrl.protocol !== "https:" ||
    hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" || hostname === "::1" ||
    (ipVersion === 4 && hostname.startsWith("127.")) ||
    appUrl.username || appUrl.password || appUrl.pathname !== "/" || appUrl.search || appUrl.hash
  ) {
    throw new MercadoPagoError("NEXT_PUBLIC_APP_URL deve ser uma origem HTTPS pública, sem localhost.");
  }

  return { accessToken, mode: mode as MercadoPagoMode, appUrl };
}

export async function createMercadoPagoPreference({
  userId,
  env = process.env,
  fetchImpl = fetch,
}: {
  userId: string;
  env?: Environment;
  fetchImpl?: Fetch;
}): Promise<{ checkoutUrl: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new MercadoPagoError("Usuário inválido para iniciar o checkout.");
  }

  const config = getMercadoPagoConfig(env);
  const webhookSecret = env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) throw new MercadoPagoError("O checkout está temporariamente indisponível.");
  const origin = config.appUrl.origin;
  const response = await fetchImpl("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      items: [{
        title: TECHPROFILE_PRO.title,
        description: "Acesso por 30 dias",
        quantity: TECHPROFILE_PRO.quantity,
        currency_id: TECHPROFILE_PRO.currency,
        unit_price: TECHPROFILE_PRO.amount,
      }],
      external_reference: createCheckoutExternalReference(userId, webhookSecret),
      back_urls: {
        success: new URL("/pagamento/sucesso", origin).toString(),
        pending: new URL("/pagamento/pendente", origin).toString(),
        failure: new URL("/pagamento/erro", origin).toString(),
      },
      auto_return: "approved",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new MercadoPagoError("Não foi possível iniciar o checkout agora.");
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new MercadoPagoError("Resposta inválida ao iniciar o checkout.");

  const record = payload as Record<string, unknown>;
  const rawCheckoutUrl = config.mode === "test" ? record.sandbox_init_point : record.init_point;
  if (typeof rawCheckoutUrl !== "string") throw new MercadoPagoError("O checkout não retornou uma URL válida.");

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(rawCheckoutUrl);
  } catch {
    throw new MercadoPagoError("O checkout não retornou uma URL válida.");
  }
  const allowedHost = ["mercadopago.com", "mercadopago.com.br"].some(
    (host) => checkoutUrl.hostname === host || checkoutUrl.hostname.endsWith(`.${host}`),
  );
  if (checkoutUrl.protocol !== "https:" || !allowedHost) {
    throw new MercadoPagoError("O checkout retornou um domínio não permitido.");
  }

  return { checkoutUrl: checkoutUrl.toString() };
}

export async function getMercadoPagoPayment(
  paymentId: string,
  { env = process.env, fetchImpl = fetch }: { env?: Environment; fetchImpl?: Fetch } = {},
): Promise<VerifiedPaymentPayload> {
  if (!/^\d{1,32}$/.test(paymentId)) throw new MercadoPagoError("Identificador de pagamento inválido.");
  const { accessToken } = getMercadoPagoConfig(env);
  const response = await fetchImpl(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new MercadoPagoError("Não foi possível confirmar o pagamento.");
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new MercadoPagoError("Resposta inválida ao consultar o pagamento.");

  const payment = payload as Record<string, unknown>;
  if (
    (typeof payment.id !== "string" && typeof payment.id !== "number") ||
    typeof payment.status !== "string" ||
    typeof payment.currency_id !== "string" ||
    typeof payment.transaction_amount !== "number" ||
    (payment.external_reference !== null && typeof payment.external_reference !== "string")
  ) {
    throw new MercadoPagoError("Resposta inválida ao consultar o pagamento.");
  }

  return {
    id: payment.id,
    status: payment.status,
    currency_id: payment.currency_id,
    transaction_amount: payment.transaction_amount,
    external_reference: payment.external_reference,
  };
}
