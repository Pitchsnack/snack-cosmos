import { describe, expect, it } from 'vitest';
import { cardAllowsExact, cardAskingPrice, cardNdaStatus, newCardDays, publicRevenueLabel } from '../../src/lib/standard-card';
describe('standard discovery card rules', () => {
  it('a requested NDA does not authorize exact asking price in Browse', () => {
    expect(cardAllowsExact('buyer', false)).toBe(false);
    expect(cardAllowsExact('buyer', true)).toBe(true);
  });
  it('public watchlist never renders an authorized exact asking price', () => {
    expect(cardAskingPrice({ askingPrice: 75_123_456 }, false, false)).toBe('฿50M – 100M');
  });
  it('private authorized view renders the exact asking price', () => {
    expect(cardAskingPrice({ askingPrice: 75_123_456 }, true, false)).toBe('฿ 75,123,456');
  });
  it('NEW ends at 14 days after publication', () => {
    const start = '2026-10-01T00:00:00Z';
    expect(newCardDays(start, Date.parse('2026-10-14T00:00:00Z'))).toBe(13);
    expect(newCardDays(start, Date.parse('2026-10-15T00:00:00Z'))).toBeNull();
  });
  it('requested and approved NDA states use the same statuses for either card kind', () => {
    expect(cardNdaStatus('requested')).toBe('requested');
    expect(cardNdaStatus('approved')).toBe('approved');
    expect(cardNdaStatus('saved')).toBe('hidden');
  });
  it('revenue bands use Under rather than Below', () => {
    expect(publicRevenueLabel('Below ฿50M')).toBe('Under ฿50M');
  });
});