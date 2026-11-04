import type { BoCard } from './buy-orders.functions';
import type { PublicListing } from './public-listing';
import { bkkToday, isOpen, overlaps, rangeOf, sellerBand } from './buy-orders';

export type DiscoveryTab = 'wanted' | 'sale';
export type DiscoveryLayout = 'grid' | 'split' | 'list';
export type DiscoveryListing = { id: string; listing: PublicListing; dealType: string | null; askingPrice: null; priceBand: { key: string; label: string; th: string } | null; handover: string | null; reason: string | null; reasonTh: string | null; views: number; ndas: number; growthBand: string | null; ebitdaMargin: string | null };
export type DiscoveryData = { orders: BoCard[]; listings: DiscoveryListing[] };
export type DiscoveryPending = { action: 'apply' | 'nda' | 'share'; tab: DiscoveryTab; id: string; ref: string; name: string; sector: string; meta: string; email?: string; token: string };
export const DISCOVERY_PENDING_KEY = 'ps-discovery-pending';
export function validPending(value: unknown): value is DiscoveryPending {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return ['apply', 'nda', 'share'].includes(String(p.action)) && ['wanted', 'sale'].includes(String(p.tab)) && ['id','ref','name','sector','meta','token'].every(k => typeof p[k] === 'string' && String(p[k]).length < 1000) && (p.action !== 'share' || (typeof p.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)));
}
export function readDiscoveryPending(): DiscoveryPending | null { try { const p: unknown = JSON.parse(sessionStorage.getItem(DISCOVERY_PENDING_KEY) || 'null'); return validPending(p) ? p : null; } catch { return null; } }
export function writeDiscoveryPending(p: DiscoveryPending | null) { try { if (p) sessionStorage.setItem(DISCOVERY_PENDING_KEY, JSON.stringify(p)); else sessionStorage.removeItem(DISCOVERY_PENDING_KEY); window.dispatchEvent(new Event('ps-discovery-pending')); } catch { /* session storage unavailable */ } }
export type DiscoveryFilters = { q: string; sector: string | null; revenue: string; price: string; place: string; sort: string; mine: boolean };
export const emptyDiscoveryFilters = (): DiscoveryFilters => ({ q: '', sector: null, revenue: '', price: '', place: '', sort: 'newest', mine: false });
export function discoveryRecent(date: string | null | undefined, now = Date.now()) { const n = date ? now - Date.parse(date) : -1; return n >= 0 && n < 7 * 86400_000; }
export function discoveryOrderOpen(c: Pick<BoCard, 'status' | 'closesOn'>, now = Date.now()) { return isOpen(c.status, c.closesOn, now); }
export function discoveryRangeMatches(raw: string | null | undefined, chosen: string) { return !chosen || overlaps(rangeOf(raw) ?? sellerBand(raw), rangeOf(chosen)); }
export function discoveryFigures(data: DiscoveryData, tab: DiscoveryTab, now = Date.now()): number[] {
  if (tab === 'wanted') { const rows = data.orders.filter(x => discoveryOrderOpen(x, now)); return [rows.length, new Set(rows.map(x => x.country?.trim()).filter(Boolean)).size, rows.filter(x => x.kind === 'sealed').length, rows.filter(x => discoveryRecent(x.postedAt, now)).length]; }
  return [data.listings.length, new Set(data.listings.map(x => x.listing.sector).filter(Boolean)).size, data.listings.filter(x => x.listing.certified).length, data.listings.filter(x => discoveryRecent(x.listing.publishedAt, now)).length];
}
export const discoveryHash = (tab: DiscoveryTab, ref?: string) => ref ? ref.toLowerCase() : tab === 'sale' ? 'for-sale' : '';
export const discoveryToday = bkkToday;