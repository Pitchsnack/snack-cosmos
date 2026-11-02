import { describe, expect, it } from 'vitest';
import { lastLoginStepOf, LAST_LOGIN_LABEL } from '../src/lib/last-login';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe('lastLoginStepOf', () => {
  it('0 to 7 days → week', () => {
    expect(lastLoginStepOf(ago(0), NOW)).toBe('week');
    expect(lastLoginStepOf(ago(7), NOW)).toBe('week');
  });
  it('8 to 31 days → month', () => {
    expect(lastLoginStepOf(ago(8), NOW)).toBe('month');
    expect(lastLoginStepOf(ago(31), NOW)).toBe('month');
  });
  it('32 to 62 days → two_months', () => {
    expect(lastLoginStepOf(ago(32), NOW)).toBe('two_months');
    expect(lastLoginStepOf(ago(62), NOW)).toBe('two_months');
  });
  it('63 or more days → three_months_plus', () => {
    expect(lastLoginStepOf(ago(63), NOW)).toBe('three_months_plus');
    expect(lastLoginStepOf(ago(400), NOW)).toBe('three_months_plus');
  });
  it('no login on record → null (no line, Show more stays centred)', () => {
    expect(lastLoginStepOf(null, NOW)).toBeNull();
    expect(lastLoginStepOf(undefined, NOW)).toBeNull();
    expect(lastLoginStepOf('not a date', NOW)).toBeNull();
  });
  it('every step has a card label', () => {
    for (const step of ['week', 'month', 'two_months', 'three_months_plus'] as const) {
      expect(LAST_LOGIN_LABEL[step]).toMatch(/^Last login/);
    }
  });
});
