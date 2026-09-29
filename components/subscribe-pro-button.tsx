"use client";

import { useCallback, useMemo, useState } from "react";
import { createCheckoutAction } from "@/features/billing/checkout-client";

export function SubscribeProButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const redirect = useCallback((url: string) => window.location.assign(url), []);
  const startCheckout = useMemo(() => createCheckoutAction({
    fetchImpl: (url, init) => fetch(url, init),
    redirect,
    onLoadingChange: setLoading,
    onError: setError,
  }), [redirect]);

  return (
    <span className="subscribe-pro-control">
      <button
        aria-busy={loading}
        className="subscribe-pro-button"
        disabled={loading}
        onClick={() => { void startCheckout(); }}
        type="button"
      >
        {loading ? "Abrindo pagamento..." : "Assinar Pro"}
      </button>
      {error && <span className="subscribe-pro-error" role="alert">{error}</span>}
    </span>
  );
}
