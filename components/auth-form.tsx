"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getFriendlyAuthError, getFriendlyConnectionError } from "@/features/auth/errors";
import { validateAuthInput, type AuthMode } from "@/features/auth/validation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { Brand } from "./brand";

type AuthFormProps = {
  mode: AuthMode;
  initialMessage?: string;
};

export function AuthForm({ mode, initialMessage }: AuthFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [messageKind, setMessageKind] = useState<"error" | "success">(initialMessage ? "success" : "error");
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    const password = String(values.get("password") ?? "");
    const confirmPassword = String(values.get("confirmPassword") ?? "");
    const validationError = validateAuthInput(mode, email, password, confirmPassword);

    if (validationError) {
      setMessage(validationError);
      setMessageKind("error");
      return;
    }

    if (!configured) {
      setMessage("A autenticação não está configurada neste ambiente. Confira as variáveis do Supabase.");
      setMessageKind("error");
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        });

        if (error) {
          setMessage(getFriendlyAuthError(error.code, mode));
          setMessageKind("error");
          return;
        }

        if (!data.session) {
          setMessage("Sua conta foi criada. Confira seu e-mail e confirme o endereço para continuar.");
          setMessageKind("success");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

        if (error) {
          setMessage(getFriendlyAuthError(error.code, mode));
          setMessageKind("error");
          return;
        }
      }

      router.replace("/analise");
      router.refresh();
    } catch {
      setMessage(configured ? getFriendlyConnectionError() : "A autenticação não está configurada neste ambiente.");
      setMessageKind("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="auth-heading">
        <Link href="/" aria-label="Voltar ao início"><Brand /></Link>
        <h1 id="auth-heading">{isSignup ? "Crie sua conta" : "Entre na sua conta"}</h1>
        <p>{isSignup ? "Use seu e-mail e uma senha para começar." : "Acesse seu espaço profissional do TechProfile AI."}</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field" htmlFor="auth-email">
            E-mail
            <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required />
          </label>
          <label className="login-field" htmlFor="auth-password">
            Senha
            <input id="auth-password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required />
          </label>
          {isSignup && (
            <label className="login-field" htmlFor="auth-confirm-password">
              Confirmar senha
              <input id="auth-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required />
            </label>
          )}

          {message && <p className={`auth-message auth-message-${messageKind}`} role={messageKind === "error" ? "alert" : "status"}>{message}</p>}
          {!configured && <p className="auth-message auth-message-error" role="alert">A autenticação não está configurada neste ambiente.</p>}

          <button className="login-submit" type="submit" disabled={pending || !configured}>
            {pending ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Já tem uma conta? " : "Ainda não tem uma conta? "}
          <Link href={isSignup ? "/entrar" : "/cadastro"}>{isSignup ? "Entrar" : "Criar conta"}</Link>
        </p>
        <Link className="login-home" href="/">Voltar ao site</Link>
      </section>
    </main>
  );
}
