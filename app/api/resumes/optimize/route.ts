import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createResumeOptimizationHandler } from "@/features/resume/optimization-api";
import { optimizeWithGemini } from "@/features/resume/providers/gemini";
import type { BillingProfile } from "@/features/billing/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "A geração está temporariamente indisponível." }, { status: 503 });

  try {
    const supabase = await createClient();
    let authenticated = false;
    let userId = "";
    return createResumeOptimizationHandler({
      isAuthenticated: async () => {
        const { data, error } = await supabase.auth.getClaims();
        const subject = data?.claims?.sub;
        authenticated = !error && typeof subject === "string" && subject.length > 0;
        userId = authenticated ? subject as string : "";
        return authenticated;
      },
      getProfile: async () => {
        if (!authenticated) return null;
        const { data, error } = await supabase.from("profiles").select("plan, pro_expires_at").eq("user_id", userId).maybeSingle();
        if (error || !data || typeof data.plan !== "string") return null;
        return { plan: data.plan, pro_expires_at: typeof data.pro_expires_at === "string" ? data.pro_expires_at : null } satisfies BillingProfile;
      },
      optimize: (input) => optimizeWithGemini(input),
    })(request);
  } catch {
    return Response.json({ error: "A geração está temporariamente indisponível." }, { status: 503 });
  }
}
