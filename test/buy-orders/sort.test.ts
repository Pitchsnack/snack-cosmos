import { describe, expect, it } from 'vitest';
import { sortBuyOrders } from '@/lib/buy-order-sort';

const orders = [
  { id: 'closed', status: 'closed', views: 100, postedAt: '2026-11-06', closesOn: '2026-11-01' },
  { id: 'new', status: 'posted', views: 2, postedAt: '2026-11-05', closesOn: '2027-01-30' },
  { id: 'popular', status: 'posted', views: 20, postedAt: '2026-11-01', closesOn: '2026-11-20' },
  { id: 'shared', status: 'posted', views: 0, postedAt: '2026-10-01', closesOn: '2027-02-01', sharedAt: '2026-11-06' },
];
describe('Businesses Wanted sort', () => {
  it('sorts newest by posted date with shared first and closed last', () => expect(sortBuyOrders(orders, 'newest').map(x => x.id)).toEqual(['shared', 'new', 'popular', 'closed']));
  it('sorts closing soonest by closing date with shared first and closed last', () => expect(sortBuyOrders(orders, 'closing').map(x => x.id)).toEqual(['shared', 'popular', 'new', 'closed']));
  it('sorts most viewed by views with shared first and closed last', () => expect(sortBuyOrders(orders, 'views').map(x => x.id)).toEqual(['shared', 'popular', 'new', 'closed']));
  it('sorts closed orders among themselves with the chosen sort', () => {
    const closed = [{ ...orders[0], id: 'older', postedAt: '2026-10-01', views: 200, closesOn: '2026-10-15' }, orders[0]];
    expect(sortBuyOrders(closed, 'newest').map(x => x.id)).toEqual(['closed', 'older']);
    expect(sortBuyOrders(closed, 'closing').map(x => x.id)).toEqual(['older', 'closed']);
    expect(sortBuyOrders(closed, 'views').map(x => x.id)).toEqual(['older', 'closed']);
  });
});