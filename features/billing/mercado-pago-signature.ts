import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";

export function verifyMercadoPagoWebhookSignature({
  signature,
  requestId,
  dataId,
  secret,
}: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  try {
    WebhookSignatureValidator.validate({
      xSignature: signature,
      xRequestId: requestId,
      dataId,
      secret,
    });
    return true;
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) return false;
    return false;
  }
}
