import { isProActive, type BillingProfile } from "./access.ts";

export type BillingPresentation = {
  badgeLabel: "Free" | "Pro";
  showSubscribe: boolean;
  validUntilLabel: string | null;
};

export function getBillingPresentation(
  profile: BillingProfile | null | undefined,
  now: Date,
): BillingPresentation {
  const proActive = isProActive(profile, now);
  const validUntil = proActive && profile?.pro_expires_at
    ? new Date(profile.pro_expires_at)
    : null;

  return {
    badgeLabel: proActive ? "Pro" : "Free",
    showSubscribe: !proActive,
    validUntilLabel: validUntil
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(validUntil)
      : null,
  };
}
