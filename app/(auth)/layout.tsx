import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  let authenticated = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      authenticated = Boolean(data?.claims);
    } catch { authenticated = false; }
  }

  if (authenticated) redirect("/analise");
  return children;
}
