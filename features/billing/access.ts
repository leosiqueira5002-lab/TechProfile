export type BillingProfile = {
  plan: string;
  pro_expires_at: string | null;
};

export function isProActive(
  profile: BillingProfile | null | undefined,
  now: Date,
): boolean {
  if (!profile || profile.plan !== "pro" || !profile.pro_expires_at) return false;

  const expiresAt = Date.parse(profile.pro_expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
