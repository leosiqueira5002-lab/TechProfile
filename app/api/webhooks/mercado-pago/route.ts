import { createMercadoPagoWebhookHandler } from "@/features/billing/mercado-pago-webhook";
import { getMercadoPagoPayment } from "@/features/billing/mercado-pago";
import { verifyMercadoPagoWebhookSignature } from "@/features/billing/mercado-pago-signature";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const handler = createMercadoPagoWebhookHandler({
    verifySignature: verifyMercadoPagoWebhookSignature,
    getPayment: (paymentId) => getMercadoPagoPayment(paymentId),
    applyPayment: async (payment) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("apply_mercado_pago_payment", {
        p_user_id: payment.userId,
        p_provider_payment_id: payment.providerPaymentId,
        p_amount: payment.amount,
        p_currency: payment.currency,
        p_status: payment.status,
        p_access_days: payment.accessDays,
      });
      if (error) throw new Error("Não foi possível registrar o pagamento.");
      return typeof data === "string" ? data : "recorded";
    },
  });

  return handler(request);
}
