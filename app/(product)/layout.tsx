import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ResumeDraftProvider } from "@/features/resume/resume-draft-context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/entrar?auth=configuration");

  let authenticated = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims);
  } catch {
    authenticated = false;
  }

  if (!authenticated) redirect("/entrar");

  return (
    <ResumeDraftProvider>
      <SiteHeader authenticated />
      {children}
    </ResumeDraftProvider>
  );
}
