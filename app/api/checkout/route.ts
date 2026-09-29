import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createCheckoutHandler } from "@/features/billing/checkout";
import { createMercadoPagoPreference } from "@/features/billing/mercado-pago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "O checkout está temporariamente indisponível." }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    return createCheckoutHandler({
      getAuthenticatedUserId: async () => {
        const { data, error } = await supabase.auth.getClaims();
        if (error) return null;
        const subject = data?.claims?.sub;
        return typeof subject === "string" ? subject : null;
      },
      createPreference: (userId) => createMercadoPagoPreference({ userId }),
    })(request);
  } catch {
    return Response.json({ error: "O checkout está temporariamente indisponível." }, { status: 503 });
  }
}
