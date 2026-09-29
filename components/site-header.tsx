import Link from "next/link";
import { ArrowIcon } from "@/components/arrow-icon";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { SubscribeProButton } from "@/components/subscribe-pro-button";
import type { BillingPresentation } from "@/features/billing/presentation";

const links = [
  { href: "/analise", label: "Analisar currículo" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#linkedin", label: "LinkedIn" },
  { href: "/#recursos", label: "Recursos" },
];

type HeaderBilling = BillingPresentation;

function AccountPlanStatus({ billing }: { billing: HeaderBilling }) {
  return (
    <span className="header-plan-status">
      <span className={`header-plan-badge ${billing.badgeLabel === "Pro" ? "is-pro" : "is-free"}`}>
        {billing.badgeLabel}
      </span>
      {billing.badgeLabel === "Pro" && billing.validUntilLabel && (
        <span className="header-plan-expiry">Pro até {billing.validUntilLabel}</span>
      )}
    </span>
  );
}

export function SiteHeader({
  authenticated = false,
  billing = { badgeLabel: "Free", showSubscribe: true, validUntilLabel: null },
}: {
  authenticated?: boolean;
  billing?: HeaderBilling;
}) {
  return (
    <header className="site-header">
      <Link aria-label="TechProfile AI — início" href="/"><Brand/></Link>
      <nav aria-label="Navegação principal" className="header-nav">
        {links.map((link) => <a href={link.href} key={link.label}>{link.label}</a>)}
      </nav>
      <div className="header-actions">{authenticated ? <><AccountPlanStatus billing={billing} />{billing.showSubscribe && <SubscribeProButton />}<SignOutButton /></> : <><a className="header-login" href="/entrar">Entrar</a><a className="header-cta" href="/analise">Começar agora <ArrowIcon className="size-4"/></a></>}</div>
      <details className="mobile-menu">
        <summary aria-label="Abrir menu"><i/><i/><i/></summary>
        <nav aria-label="Menu principal para celular">{links.map((link) => <a href={link.href} key={link.label}>{link.label}</a>)}{authenticated ? <><AccountPlanStatus billing={billing} />{billing.showSubscribe && <SubscribeProButton />}<SignOutButton /></> : <><a href="/entrar">Entrar</a><a className="button-primary" href="/analise">Começar agora <ArrowIcon className="size-4"/></a></>}</nav>
      </details>
    </header>
  );
}
