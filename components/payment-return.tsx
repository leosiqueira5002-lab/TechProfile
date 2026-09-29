import Link from "next/link";
import { Brand } from "@/components/brand";
import { PAYMENT_RETURN_CONTENT, type PaymentReturnKind } from "@/features/billing/payment-return";

export function PaymentReturn({ kind }: { kind: PaymentReturnKind }) {
  const content = PAYMENT_RETURN_CONTENT[kind];

  return (
    <main className="payment-return-page">
      <header className="payment-return-header">
        <Link aria-label="TechProfile AI — início" href="/"><Brand /></Link>
      </header>
      <section className="payment-return-content" aria-labelledby="payment-return-title">
        <p className="section-eyebrow">{content.eyebrow}</p>
        <h1 id="payment-return-title">{content.title}</h1>
        <p>{content.description}</p>
        <Link className="button-primary" href="/analise">Voltar ao TechProfile AI</Link>
      </section>
    </main>
  );
}
