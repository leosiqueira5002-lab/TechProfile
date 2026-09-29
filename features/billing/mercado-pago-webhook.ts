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
  verifySignature: (input: { signature: string | null; requestId: string | null; dataId: string | null; secret: string }) => boolean;
  getPayment: (paymentId: string) => Promise<VerifiedPaymentPayload>;
  applyPayment: (payment: VerifiedPaymentForGrant) => Promise<string>;
  log?: (event: string, metadata: Record<string, boolean | string | null>) => void;
};

function acknowledgement(status = 200) {
  return Response.json({ received: true }, { status, headers: { "cache-control": "no-store" } });
}

export function createMercadoPagoWebhookHandler({
  env = process.env,
  verifySignature,
  getPayment,
  applyPayment,
  log = () => {},
}: Dependencies) {
  return async function handleMercadoPagoWebhook(request: Request): Promise<Response> {
    const secret = env.MERCADO_PAGO_WEBHOOK_SECRET ?? null;
    const signature = request.headers.get("x-signature");
    const requestId = request.headers.get("x-request-id");
    const url = new URL(request.url);
    const dataId = url.searchParams.get("data.id");
    const queryType = url.searchParams.get("type") ?? url.searchParams.get("topic");
    const queryAction = url.searchParams.get("action");
    const safeType = (value: string | null) => value && ["payment", "order", "merchant_order", "topic_merchant_order"].includes(value) ? value : value ? "other" : null;
    const safeAction = (value: unknown) => typeof value === "string" && [
      "payment.created", "payment.updated", "order.created", "order.updated",
    ].includes(value) ? value : value ? "other" : null;

    log("received", {
      type: safeType(queryType),
      action: safeAction(queryAction),
      hasSignature: Boolean(signature),
      hasRequestId: Boolean(requestId),
      hasDataId: Boolean(dataId),
    });

    if (!secret || !env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || !env.MERCADO_PAGO_MODE?.trim()) {
      log("failed", { stage: "configuration", result: "unavailable" });
      return acknowledgement(503);
    }

    let signatureValid = false;
    try {
      signatureValid = verifySignature({ signature, requestId, dataId, secret });
    } catch {
      signatureValid = false;
    }
    log("signature", { result: signatureValid ? "valid" : "invalid" });
    if (!signatureValid) {
      log("failed", { stage: "signature", result: "invalid" });
      return acknowledgement(401);
    }
    if (!dataId || dataId.length > 32 || !/^[a-z\d]+$/i.test(dataId)) {
      log("failed", { stage: "query_data_id", result: "invalid" });
      return acknowledgement(400);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 64 * 1024) {
      log("failed", { stage: "body_size", result: "too_large" });
      return acknowledgement(413);
    }

    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (Buffer.byteLength(rawBody) > 64 * 1024) {
        log("failed", { stage: "body_size", result: "too_large" });
        return acknowledgement(413);
      }
      payload = JSON.parse(rawBody);
    } catch {
      log("failed", { stage: "body_parsing", result: "invalid" });
      return acknowledgement(400);
    }
    if (!payload || typeof payload !== "object") {
      log("failed", { stage: "body_parsing", result: "invalid" });
      return acknowledgement(400);
    }

    const notification = payload as Record<string, unknown>;
    log("notification", {
      type: safeType(typeof notification.type === "string" ? notification.type : queryType),
      action: safeAction(notification.action),
    });
    const data = notification.data;
    const bodyDataId = data && typeof data === "object" ? (data as Record<string, unknown>).id : undefined;
    const bodyType = typeof notification.type === "string" ? notification.type : null;
    const eventType = queryType ?? bodyType;

    if (bodyDataId !== undefined && String(bodyDataId).toLowerCase() !== dataId.toLowerCase()) {
      log("failed", { stage: "body_query_consistency", result: "mismatch" });
      return acknowledgement(400);
    }
    if (queryType && bodyType && queryType !== bodyType) {
      log("failed", { stage: "event_type_consistency", result: "mismatch" });
      return acknowledgement(400);
    }
    if (eventType !== "payment") return acknowledgement();

    let payment: VerifiedPaymentPayload;
    try {
      payment = await getPayment(dataId);
    } catch {
      log("failed", { stage: "payment_lookup", result: "unavailable" });
      return acknowledgement(503);
    }

    if (String(payment.id).toLowerCase() !== dataId.toLowerCase()) {
      log("failed", { stage: "payment_validation", result: "id_mismatch" });
      return acknowledgement();
    }
    if (!acceptedStatuses.has(payment.status)) {
      log("payment_validation", { result: "status_not_accepted" });
      return acknowledgement();
    }

    let mode: string;
    try {
      mode = getMercadoPagoConfig(env).mode;
    } catch {
      log("failed", { stage: "configuration", result: "invalid_mode" });
      return acknowledgement(503);
    }
    if (payment.live_mode !== (mode === "production")) {
      log("payment_validation", { result: "mode_mismatch" });
      return acknowledgement();
    }
    const userId = verifyCheckoutExternalReference(payment.external_reference, secret);
    if (
      payment.transaction_amount !== TECHPROFILE_PRO.amount ||
      payment.currency_id !== TECHPROFILE_PRO.currency ||
      !userId
    ) {
      log("payment_validation", { result: "payment_fields_rejected" });
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
      log("failed", { stage: "supabase_rpc", result: "unavailable" });
      return acknowledgement(503);
    }

    log("completed", { stage: "supabase_rpc", result: "recorded" });
    return acknowledgement();
  };
}
