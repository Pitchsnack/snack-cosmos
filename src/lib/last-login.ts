/**
 * Last-login steps for browse cards (browser-safe). The server returns only
 * the step — never a timestamp or a user id — so a hidden card can't be
 * traced to a person.
 */
export type LastLoginStep = 'week' | 'month' | 'two_months' | 'three_months_plus';

const DAY = 86_400_000;

/** Bucket a last-active time into the card's four lines. null/invalid → null (no line). */
export function lastLoginStepOf(ts: string | number | Date | null | undefined, now = Date.now()): LastLoginStep | null {
  if (ts == null) return null;
  const t = ts instanceof Date ? ts.getTime() : typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!Number.isFinite(t) || t > now + DAY) return null;
  const days = Math.floor((now - t) / DAY);
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  if (days <= 62) return 'two_months';
  return 'three_months_plus';
}

/** The card line for a step (translated with t()). */
export const LAST_LOGIN_LABEL: Record<LastLoginStep, string> = {
  week: 'Last login within 1 week',
  month: 'Last login within 1 month',
  two_months: 'Last login within 2 months',
  three_months_plus: 'Last login 3+ months ago',
};
