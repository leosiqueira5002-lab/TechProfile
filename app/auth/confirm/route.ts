import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!isSupabaseConfigured() || !code) {
    return NextResponse.redirect(new URL("/entrar?auth=confirmation", request.url));
  }

  const response = NextResponse.redirect(new URL("/analise", request.url));
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      }),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/entrar?auth=confirmation", request.url));
  return response;
}
