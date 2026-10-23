import { describe, expect, it } from 'vitest';
import { agreementTiming, bangkokDay, nextBangkokMidnight, showsAgreements } from '../../src/lib/agreement-dates';
const today = bangkokDay('2026-10-23T00:00:00+07:00') ?? 0;
const timing = (end: string) => agreementTiming('2026-10-01T00:00:00+07:00', end, today);
describe('Live legal agreement dates', () => {
  it('counts Thailand calendar days rather than elapsed hours', () => expect(timing('2026-10-25T23:59:00+07:00')?.daysLeft).toBe(2));
  it('uses green above 14 days', () => expect(timing('2026-11-07T00:00:00+07:00')?.tone).toBe('active'));
  it('uses amber at 14 days', () => expect(timing('2026-11-06T00:00:00+07:00')?.tone).toBe('soon'));
  it('keeps the end day amber at zero days', () => expect(timing('2026-10-23T00:00:00+07:00')).toMatchObject({ tone: 'soon', daysLeft: 0 }));
  it('uses grey after the end day', () => expect(timing('2026-10-22T23:59:00+07:00')).toMatchObject({ tone: 'ended', daysLeft: -1 }));
  it('advances the date at Bangkok midnight', () => expect(bangkokDay('2026-10-22T17:00:00Z')).toBe(today));
  it('schedules the next update at Thailand midnight', () => expect(nextBangkokMidnight(Date.parse('2026-10-23T03:32:00Z'))).toBe(Date.parse('2026-10-23T17:00:00Z')));
  it('uses the stored end rather than recomputing a term', () => expect(timing('2026-10-25T00:00:00+07:00')?.termDays).toBe(24));
  it('clamps the elapsed bar to the full term after expiry', () => expect(timing('2026-10-22T00:00:00+07:00')?.progress).toBe(1));
  it('does not invent missing end dates', () => expect(agreementTiming('2026-10-01', null, today)).toBeNull());
  it('shows only seller-accepted LOI deals', () => { expect(showsAgreements({ status: 'active', ndaApprovedAt: '2026-10-01', loiAcceptedAt: '2026-10-20' })).toBe(true); expect(showsAgreements({ status: 'active', ndaApprovedAt: '2026-10-01', loiAcceptedAt: null })).toBe(false); });
  it('excludes ended deals and pending NDA cards', () => { expect(showsAgreements({ status: 'ended', ndaApprovedAt: '2026-10-01', loiAcceptedAt: '2026-10-20' })).toBe(false); expect(showsAgreements({ status: 'active', ndaApprovedAt: null, loiAcceptedAt: null })).toBe(false); });
});