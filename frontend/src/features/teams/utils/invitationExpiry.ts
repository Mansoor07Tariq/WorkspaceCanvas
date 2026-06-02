/**
 * Format an invitation's `expires_at` into a short human label.
 *
 * No date library: uses the built-in Date and a day-difference calc so the
 * pending-invitations list can show "Expires in 6 days" / "Expires today" /
 * "Expired" without pulling in extra weight.
 */

export interface InvitationExpiry {
  expired: boolean;
  label: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function formatInvitationExpiry(
  expiresAt: string | null,
  now: Date = new Date()
): InvitationExpiry {
  if (!expiresAt) {
    return { expired: false, label: "No expiry" };
  }

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return { expired: false, label: "No expiry" };
  }

  if (expiry.getTime() <= now.getTime()) {
    return { expired: true, label: "Expired" };
  }

  // Whole calendar-day difference between today and the expiry day.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const days = Math.round((startOfExpiry.getTime() - startOfToday.getTime()) / MS_PER_DAY);

  if (days <= 0) {
    return { expired: false, label: "Expires today" };
  }
  if (days === 1) {
    return { expired: false, label: "Expires tomorrow" };
  }
  return { expired: false, label: `Expires in ${days} days` };
}
