import { describe, expect, it } from 'vitest';
import { dealCompanyName } from '../../src/lib/pipeline-company';

describe('Deal-specific own organisation', () => {
  it('seller uses the company for each deal, not the buyer firm', () => {
    expect(dealCompanyName(true, 'Company A', 'Same buyer')).toBe('Company A');
    expect(dealCompanyName(true, 'Company B', 'Same buyer')).toBe('Company B');
  });
  it('buyer uses its firm even before NDA approval or after withdrawal', () => {
    expect(dealCompanyName(false, 'Anonymous seller', 'Firm A')).toBe('Firm A');
    expect(dealCompanyName(false, 'Same seller', 'Firm B')).toBe('Firm B');
  });
  it('missing organisation does not fall back to the other party', () => {
    expect(dealCompanyName(true, null, 'Buyer')).toBeNull();
    expect(dealCompanyName(false, 'Seller', '  ')).toBeNull();
  });
});