import { describe, it, expect } from 'vitest';
import { createConnectFlightGuard } from '../../src/lib/connect-flight-state';
describe('Seller Connect flight', () => {
  it('plays only once per invitation', () => { const claim = createConnectFlightGuard(); expect(claim('inv-1')).toBe(true); expect(claim('inv-1')).toBe(false); });
  it('allows another stored invitation independently', () => { const claim = createConnectFlightGuard(); claim('inv-1'); expect(claim('inv-2')).toBe(true); });
  it('never plays without a stored invitation ID', () => { expect(createConnectFlightGuard()('')).toBe(false); });
});