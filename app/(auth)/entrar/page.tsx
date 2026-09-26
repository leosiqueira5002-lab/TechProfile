import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = {
  title: "Entrar — TechProfile AI",
  description: "Acesse seu espaço profissional no TechProfile AI.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-heading">
        <Link href="/" aria-label="Voltar ao início"><Brand/></Link>
        <h1 id="login-heading">Entre na sua conta</h1>
        <p>Acesse seu espaço profissional do TechProfile AI.</p>
        <label className="login-field" htmlFor="email">E-mail<input id="email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" /></label>
        <label className="login-field" htmlFor="password">Senha<input id="password" name="password" type="password" autoComplete="current-password" placeholder="Sua senha" /></label>
        <button className="login-submit" type="button" aria-describedby="login-note">Entrar</button>
        <p className="login-note" id="login-note">A autenticação será habilitada em uma próxima etapa.</p>
        <Link className="login-home" href="/">Voltar ao site</Link>
      </section>
    </main>
  );
}
