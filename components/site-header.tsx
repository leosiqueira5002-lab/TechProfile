import Link from "next/link";
import { ArrowIcon } from "@/components/arrow-icon";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

const links = [
  { href: "/analise", label: "Analisar currículo" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#linkedin", label: "LinkedIn" },
  { href: "/#recursos", label: "Recursos" },
];

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <header className="site-header">
      <Link aria-label="TechProfile AI — início" href="/"><Brand/></Link>
      <nav aria-label="Navegação principal" className="header-nav">
        {links.map((link) => <a href={link.href} key={link.label}>{link.label}</a>)}
      </nav>
      <div className="header-actions">{authenticated ? <SignOutButton /> : <><a className="header-login" href="/entrar">Entrar</a><a className="header-cta" href="/analise">Começar agora <ArrowIcon className="size-4"/></a></>}</div>
      <details className="mobile-menu">
        <summary aria-label="Abrir menu"><i/><i/><i/></summary>
        <nav aria-label="Menu principal para celular">{links.map((link) => <a href={link.href} key={link.label}>{link.label}</a>)}{authenticated ? <SignOutButton /> : <><a href="/entrar">Entrar</a><a className="button-primary" href="/analise">Começar agora <ArrowIcon className="size-4"/></a></>}</nav>
      </details>
    </header>
  );
}
