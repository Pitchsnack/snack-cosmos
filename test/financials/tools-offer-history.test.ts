import { describe, expect, it } from 'vitest';
import { createOfferHistory } from '../../src/lib/tools-offer-history';
describe('Tools offer return destination', () => {
  it('skips financials and valuation tabs back to My Company', () => {
    const h = createOfferHistory({ pathname: '/my-startups', index: 0 });
    h.record({ pathname: '/my-financials', index: 1 }, 'PUSH');
    h.record({ pathname: '/my-valuation', index: 2 }, 'PUSH');
    expect(h.backDistance({ pathname: '/my-valuation', index: 2 })).toBe(2);
  });
  it('skips reverse tab switches and company search changes', () => {
    const h = createOfferHistory({ pathname: '/marketplace/browse', index: 3 });
    h.record({ pathname: '/my-valuation', index: 4 }, 'PUSH');
    h.record({ pathname: '/my-financials', index: 5 }, 'PUSH');
    h.record({ pathname: '/my-financials', index: 6 }, 'PUSH');
    expect(h.backDistance({ pathname: '/my-financials', index: 6 })).toBe(3);
  });
  it('falls back on direct entry despite prior browser history', () => {
    const h = createOfferHistory({ pathname: '/my-verification', index: 7 });
    expect(h.backDistance({ pathname: '/my-verification', index: 7 })).toBeNull();
  });
  it('returns from risk and verification to the actual prior page', () => {
    const h = createOfferHistory({ pathname: '/my-startups', index: 0 });
    h.record({ pathname: '/my-risk', index: 1 }, 'PUSH');
    h.record({ pathname: '/my-verification', index: 2 }, 'PUSH');
    expect(h.backDistance({ pathname: '/my-verification', index: 2 })).toBe(1);
    expect(h.backDistance({ pathname: '/my-risk', index: 1 })).toBe(1);
  });
  it('discards forward entries on a new navigation after Back', () => {
    const h = createOfferHistory({ pathname: '/my-startups', index: 0 });
    h.record({ pathname: '/my-financials', index: 1 }, 'PUSH');
    h.record({ pathname: '/my-valuation', index: 2 }, 'PUSH');
    h.record({ pathname: '/my-startups', index: 0 }, 'BACK');
    h.record({ pathname: '/my-risk', index: 1 }, 'PUSH');
    expect(h.backDistance({ pathname: '/my-risk', index: 1 })).toBe(1);
  });
});
