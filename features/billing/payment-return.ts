export type PaymentReturnKind = "success" | "pending" | "error";

export const PAYMENT_RETURN_CONTENT: Record<PaymentReturnKind, { eyebrow: string; title: string; description: string }> = {
  success: {
    eyebrow: "RETORNO RECEBIDO",
    title: "Estamos confirmando seu pagamento",
    description: "O acesso Pro será liberado somente depois que o Mercado Pago confirmar o pagamento ao nosso servidor.",
  },
  pending: {
    eyebrow: "PAGAMENTO PENDENTE",
    title: "Aguardando confirmação",
    description: "Assim que o Mercado Pago confirmar o pagamento, o período Pro será atualizado automaticamente.",
  },
  error: {
    eyebrow: "PAGAMENTO NÃO CONFIRMADO",
    title: "Não foi possível confirmar o pagamento",
    description: "Nenhum acesso Pro foi liberado por este retorno. Você pode voltar ao TechProfile AI e tentar novamente.",
  },
};
