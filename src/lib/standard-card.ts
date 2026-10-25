import { bandOf as priceBandOf, fmtThb } from '@/lib/asking-price';

export type CardNdaStatus = 'hidden' | 'requested' | 'approved';
export function cardNdaStatus(status?: string | null): CardNdaStatus {
  return status === 'approved' ? 'approved' : status === 'requested' ? 'requested' : 'hidden';
}
export function publicRevenueLabel(value?: string | null) {
  return value?.replace(/^Below\s+/i, 'Under ') ?? null;
}
/** A public watchlist tab is always the public range, even when its DTO also has an authorized exact amount. */
export function cardAskingPrice(deal: { askingPrice?: number | null; priceBand?: { label: string; th: string } | null } | undefined, exact: boolean, thai: boolean) {
  if (exact && deal?.askingPrice != null) return fmtThb(deal.askingPrice);
  const band = deal?.priceBand ?? priceBandOf(deal?.askingPrice);
  return band ? (thai ? band.th : band.label) : null;
}
export function newCardDays(published: string | null | undefined, now = Date.now()): number | null {
  if (!published) return null;
  const days = Math.floor((now - new Date(published).getTime()) / 86_400_000);
  return days >= 0 && days < 14 ? days : null;
}