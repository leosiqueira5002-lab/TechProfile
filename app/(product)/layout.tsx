import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getBillingPresentation } from "@/features/billing/presentation";
import type { BillingProfile } from "@/features/billing/access";
import { ResumeDraftProvider } from "@/features/resume/resume-draft-context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/entrar?auth=configuration");

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let userId: string | null = null;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    userId = null;
  }

  if (!userId || !supabase) redirect("/entrar");

  let profile: BillingProfile | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("plan, pro_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (
      !error && data && typeof data.plan === "string" &&
      (data.pro_expires_at === null || typeof data.pro_expires_at === "string")
    ) {
      profile = { plan: data.plan, pro_expires_at: data.pro_expires_at };
    }
  } catch {
    // Profile indisponível: a interface falha de forma segura para Free.
  }
  const billing = getBillingPresentation(profile, new Date());

  return (
    <ResumeDraftProvider canExportPdf={billing.badgeLabel === "Pro"} canGenerateResume={billing.badgeLabel === "Pro"}>
      <SiteHeader authenticated billing={billing} />
      {children}
    </ResumeDraftProvider>
  );
}
