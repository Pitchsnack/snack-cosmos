import { describe, expect, test } from 'bun:test';
import { buyerAboutError, buyerDescriptionError, descriptionWords, suggestBuyerDescription } from '../../src/lib/buyer-description';

describe('Buyer About Company', () => {
  test('80 English words allowed; 81 rejected', () => {
    expect(buyerAboutError(Array(80).fill('word').join(' '), '')).toBeNull();
    expect(buyerAboutError(Array(81).fill('word').join(' '), '')).toBe('Keep it to 80 words.');
  });
  test('Thai is counted independently with word-like segments', () => {
    const thai80 = Array(40).fill('บริษัทลงทุน').join(' ');
    expect(descriptionWords(thai80)).toBe(80);
    expect(buyerAboutError(thai80, '')).toBeNull();
    expect(buyerAboutError(thai80 + ' บริษัท', '')).toBe('Keep it to 80 words.');
  });
  test('unchanged legacy text does not block another edit', () => {
    const old = Array(81).fill('word').join(' ');
    expect(buyerAboutError(old, old)).toBeNull();
    expect(buyerAboutError(old + ' changed', old)).toBe('Keep it to 80 words.');
    expect(buyerAboutError(undefined, old)).toBeNull();
  });
  test('directory Admin bypass is preserved', () => expect(buyerAboutError(Array(81).fill('word').join(' '), '', true)).toBeNull());
  test('empty and short About Company have no minimum', () => {
    expect(buyerAboutError('', 'old')).toBeNull();
    expect(buyerAboutError('a', '')).toBeNull();
  });
});
describe('Buyer public suggestions', () => {
  const facts = { type:'Private Equity', industries:['FinTech'], geography:['Thailand'] };
  test('English suggestion fits 25 words and two sentences', () => {
    const s = suggestBuyerDescription(facts, 'en');
    expect(buyerDescriptionError(s)).toBeNull();
    expect(s).toContain('FinTech');
    expect(s).toContain('Thailand');
  });
  test('Thai suggestion fits the same rules', () => expect(buyerDescriptionError(suggestBuyerDescription(facts, 'th'))).toBeNull());
});