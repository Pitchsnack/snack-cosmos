import { describe, expect, test } from 'bun:test';
import { buyerDescriptionError, descriptionChanged, descriptionSentences, descriptionWords, singleLineDescription } from '../../src/lib/buyer-description';
import { descriptionLeaks, regError, ticketColumns } from '../../src/lib/investor-bands';
describe('Buyer description rules', () => {
  test('empty is allowed', () => expect(buyerDescriptionError('')).toBeNull());
  test('10 characters minimum', () => { expect(buyerDescriptionError('123456789')).toBe('Write at least 10 characters.'); expect(buyerDescriptionError('1234567890')).toBeNull(); });
  test('25 words allowed, 26 rejected', () => { expect(buyerDescriptionError(Array(25).fill('word').join(' '))).toBeNull(); expect(buyerDescriptionError(Array(26).fill('word').join(' '))).toBe('Keep it to 25 words.'); });
  test('2 sentences allowed, 3 rejected first', () => { expect(buyerDescriptionError('We buy companies. We support founders.')).toBeNull(); expect(buyerDescriptionError('We buy. We help. We grow.')).toBe('Keep it to 2 sentences.'); });
  test('abbreviations and unpunctuated text', () => { expect(descriptionSentences('We buy e.g. snacks and drinks. We help founders.')).toBe(2); expect(descriptionSentences('We buy companies without a full stop')).toBe(1); });
  test('capital, digit, quotes and brackets start sentences', () => expect(descriptionSentences('First! "Next? (Third. 4th')).toBe(4));
  test('hyphenated word counts once', () => expect(descriptionWords('founder-led growth')).toBe(2));
  test('Thai words use segmenter and fallback counts one run', () => { expect(descriptionWords('บริษัทลงทุน')).toBe(2); expect(descriptionWords('บริษัทลงทุน', false)).toBe(1); expect(descriptionSentences('บริษัทลงทุนในประเทศไทย')).toBe(1); });
  test('pasted newlines become spaces', () => expect(singleLineDescription('One\r\nTwo\nThree')).toBe('One Two Three'));
  test('unchanged legacy descriptions are grandfathered', () => { const old = Array(26).fill('word').join(' '); expect(descriptionChanged(old, old)).toBe(false); expect(descriptionChanged(old + ' changed', old)).toBe(true); expect(descriptionChanged(undefined, old)).toBe(false); });
  test('identity check stays active', () => expect(descriptionLeaks('Lakeshore buys profitable companies', 'Lakeshore Capital', '')).toContain('Lakeshore'));
  test('Thailand requires exactly 13 registration digits; elsewhere optional', () => { expect(regError('1234567890123', 'Thailand')).toBeNull(); expect(regError('123456789012', 'Thailand')).toBe('The registration number has 13 digits.'); expect(regError('', 'Singapore')).toBeNull(); });
  test('ticket band still fills min and max', () => expect(ticketColumns('tkt_10_25')).toEqual({ min: '10000000', max: '25000000' }));
});