"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setPending(true);
    setError("");

    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) {
        setError("Não foi possível encerrar a sessão. Tente novamente.");
        return;
      }

      router.replace("/entrar");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao serviço de autenticação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="sign-out-control">
      <button className="header-login sign-out-button" type="button" onClick={handleSignOut} disabled={pending}>
        {pending ? "Saindo…" : "Sair"}
      </button>
      {error && <span className="sign-out-error" role="alert">{error}</span>}
    </span>
  );
}
