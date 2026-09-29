import { TECHPROFILE_PRO, getMercadoPagoConfig, verifyCheckoutExternalReference, type VerifiedPaymentPayload } from "./mercado-pago.ts";

const acceptedStatuses = new Set(["approved", "pending", "in_process", "rejected", "cancelled", "refunded", "charged_back", "authorized"]);

export type VerifiedPaymentForGrant = {
  providerPaymentId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  accessDays: number;
};

type Environment = Record<string, string | undefined>;

type Dependencies = {
  env?: Environment;
  verifySignature: (input: { signature: string; requestId: string; dataId: string; secret: string }) => boolean;
  getPayment: (paymentId: string) => Promise<VerifiedPaymentPayload>;
  applyPayment: (payment: VerifiedPaymentForGrant) => Promise<string>;
};

function acknowledgement(status = 200) {
  return Response.json({ received: true }, { status, headers: { "cache-control": "no-store" } });
}

export function createMercadoPagoWebhookHandler({
  env = process.env,
  verifySignature,
  getPayment,
  applyPayment,
}: Dependencies) {
  return async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
    const secret = env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
    const signature = request.headers.get("x-signature") ?? "";
    const requestId = request.headers.get("x-request-id") ?? "";
    const url = new URL(request.url);
    const dataId = url.searchParams.get("data.id") ?? "";

    if (!secret || !env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || !env.MERCADO_PAGO_MODE?.trim()) {
      return acknowledgement(503);
    }
    if (!dataId || dataId.length > 32 || !/^[a-z\d]+$/i.test(dataId) || !verifySignature({ signature, requestId, dataId, secret })) {
      return acknowledgement(401);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 64 * 1024) return acknowledgement(413);

    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (Buffer.byteLength(rawBody) > 64 * 1024) return acknowledgement(413);
      payload = JSON.parse(rawBody);
    } catch {
      return acknowledgement(400);
    }
    if (!payload || typeof payload !== "object") return acknowledgement(400);

    const notification = payload as Record<string, unknown>;
    const data = notification.data;
    const bodyDataId = data && typeof data === "object" ? (data as Record<string, unknown>).id : undefined;
    const queryType = url.searchParams.get("type") ?? url.searchParams.get("topic");
    const bodyType = typeof notification.type === "string" ? notification.type : null;
    const eventType = queryType ?? bodyType;

    if (bodyDataId !== undefined && String(bodyDataId).toLowerCase() !== dataId.toLowerCase()) return acknowledgement(400);
    if (queryType && bodyType && queryType !== bodyType) return acknowledgement(400);
    if (eventType !== "payment") return acknowledgement();

    let payment: VerifiedPaymentPayload;
    try {
      payment = await getPayment(dataId);
    } catch {
      return acknowledgement(503);
    }

    if (String(payment.id).toLowerCase() !== dataId.toLowerCase()) return acknowledgement();
    if (!acceptedStatuses.has(payment.status)) return acknowledgement();

    let mode: string;
    try {
      mode = getMercadoPagoConfig(env).mode;
    } catch {
      return acknowledgement(503);
    }
    if (payment.live_mode !== (mode === "production")) return acknowledgement();
    const userId = verifyCheckoutExternalReference(payment.external_reference, secret);
    if (
      payment.transaction_amount !== TECHPROFILE_PRO.amount ||
      payment.currency_id !== TECHPROFILE_PRO.currency ||
      !userId
    ) {
      return acknowledgement();
    }

    try {
      await applyPayment({
        providerPaymentId: String(payment.id),
        userId,
        amount: TECHPROFILE_PRO.amount,
        currency: TECHPROFILE_PRO.currency,
        status: payment.status,
        accessDays: TECHPROFILE_PRO.accessDays,
      });
    } catch {
      return acknowledgement(503);
    }

    return acknowledgement();
  };
}
