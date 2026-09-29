type CheckoutHandlerDependencies = {
  getAuthenticatedUserId: () => Promise<string | null>;
  createPreference: (userId: string) => Promise<{ checkoutUrl: string }>;
};

const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCheckoutHandler({
  getAuthenticatedUserId,
  createPreference,
}: CheckoutHandlerDependencies) {
  return async function handleCheckout(_request: Request): Promise<Response> {
    let userId: string | null = null;
    try {
      userId = await getAuthenticatedUserId();
    } catch {
      return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    }

    if (!userId || !userIdPattern.test(userId)) {
      return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    }

    try {
      const { checkoutUrl } = await createPreference(userId);
      return Response.json(
        { checkoutUrl },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    } catch {
      return Response.json({ error: "Não foi possível iniciar o checkout agora." }, { status: 502 });
    }
  };
}
