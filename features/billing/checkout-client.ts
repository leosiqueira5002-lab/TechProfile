type CheckoutActionDependencies = {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  redirect: (url: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
};

const checkoutError = "Não foi possível iniciar o pagamento. Tente novamente.";

export function createCheckoutAction({
  fetchImpl,
  redirect,
  onLoadingChange,
  onError,
}: CheckoutActionDependencies) {
  let pending = false;

  return async function startCheckout(): Promise<void> {
    if (pending) return;
    pending = true;
    onError("");
    onLoadingChange(true);

    try {
      const response = await fetchImpl("/api/checkout", { method: "POST" });
      if (!response.ok) throw new Error("Checkout request failed");

      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("checkoutUrl" in payload)) {
        throw new Error("Checkout URL missing");
      }

      const checkoutUrl = payload.checkoutUrl;
      if (typeof checkoutUrl !== "string" || !checkoutUrl.trim()) {
        throw new Error("Checkout URL missing");
      }

      const parsedUrl = new URL(checkoutUrl);
      if (parsedUrl.protocol !== "https:") throw new Error("Checkout URL is invalid");

      redirect(parsedUrl.href);
    } catch {
      onError(checkoutError);
    } finally {
      pending = false;
      onLoadingChange(false);
    }
  };
}
