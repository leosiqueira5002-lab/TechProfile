import { createMercadoPagoWebhookHandler } from "@/features/billing/mercado-pago-webhook";
import { getMercadoPagoPayment } from "@/features/billing/mercado-pago";
import { verifyMercadoPagoWebhookSignature } from "@/features/billing/mercado-pago-signature";
import { summarizeSupabaseRpcError } from "@/features/billing/supabase-rpc-diagnostics";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function logRpcDiagnostic(stage: string, error?: unknown) {
  const diagnostic = summarizeSupabaseRpcError(error);
  console.error("mercado_pago_rpc_diagnostic", {
    stage,
    ...diagnostic,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasSupabasePublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
  });
}

export async function POST(request: Request) {
  const handler = createMercadoPagoWebhookHandler({
    verifySignature: verifyMercadoPagoWebhookSignature,
    getPayment: (paymentId) => getMercadoPagoPayment(paymentId),
    applyPayment: async (payment) => {
      let supabase;
      try {
        supabase = createAdminClient();
      } catch {
        logRpcDiagnostic("admin_client_initialization");
        throw new Error("Não foi possível registrar o pagamento.");
      }

      let data: unknown;
      try {
        const result = await supabase.rpc("apply_mercado_pago_payment", {
          p_user_id: payment.userId,
          p_provider_payment_id: payment.providerPaymentId,
          p_amount: payment.amount,
          p_currency: payment.currency,
          p_status: payment.status,
          p_access_days: payment.accessDays,
        });
        if (result.error) {
          logRpcDiagnostic("rpc_response", result.error);
          throw new Error("RPC failed");
        }
        data = result.data;
      } catch (error) {
        if (!(error instanceof Error && error.message === "RPC failed")) {
          logRpcDiagnostic("rpc_transport", error);
        }
        throw new Error("Não foi possível registrar o pagamento.");
      }
      return typeof data === "string" ? data : "recorded";
    },
    log: (event, metadata) => console.info("mercado_pago_webhook", { event, ...metadata }),
  });

  return handler(request);
}
