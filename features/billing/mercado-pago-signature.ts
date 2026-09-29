import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoWebhookSignature({
  signature,
  requestId,
  dataId,
  secret,
}: {
  signature: string;
  requestId: string;
  dataId: string;
  secret: string;
}): boolean {
  if (!signature || !requestId || !dataId || !secret) return false;

  const parts = new Map<string, string>();
  for (const field of signature.split(",")) {
    const separator = field.indexOf("=");
    if (separator <= 0) return false;
    const key = field.slice(0, separator).trim();
    const value = field.slice(separator + 1).trim();
    if ((key === "ts" || key === "v1") && (!value || parts.has(key))) return false;
    if (key === "ts" || key === "v1") parts.set(key, value);
  }

  const timestamp = parts.get("ts");
  const receivedHash = parts.get("v1");
  if (!timestamp || !/^\d+$/.test(timestamp) || !receivedHash || !/^[a-f\d]{64}$/i.test(receivedHash)) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest();
  const providedHash = Buffer.from(receivedHash, "hex");
  return expectedHash.length === providedHash.length && timingSafeEqual(expectedHash, providedHash);
}
