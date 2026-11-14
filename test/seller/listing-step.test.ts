import { describe, expect, it } from 'vitest';
import { emptyDraft, sellerListingValid, sellerProgress, sellerQuestionKeys, listingPayload } from '../../src/lib/seller-wizard';
import { mergeWebsiteEnrich } from '../../src/lib/seller-website-enrich';
const draft = () => ({ ...emptyDraft(), listingName: 'Regional Logistics Network', headline: 'Logistics business serving regional customers' });
describe('seller Listing setup rules', () => {
  it('adds Listing after Founder before review and counts nine questions after signup', () => {
    const d = { ...draft(), role: 'owner' as const, name: 'Company', reg: '0105555123450', addr: { street: '1 Road', unit: '', district: 'District', province: 'Bangkok', postal: '10110' }, year: '2014', size: '11-50', sector: 'Packaging' };
    const signup = ['role', 'address', 'year', 'size', 'sector'];
    expect(sellerQuestionKeys(d, signup)).toEqual(['web', 'rev', 'lic', 'photos', 'deal', 'handover', 'price', 'founder', 'listing']);
    expect(sellerProgress(d, signup).N).toBe(9);
  });
  it('keeps completed setups on their former questions', () => expect(sellerQuestionKeys({ ...draft(), setupDoneAt: '2026-11-14T00:00:00Z' })).not.toContain('listing'));
  it('requires a listing name', () => expect(sellerListingValid({ ...draft(), listingName: ' ' })).toBe(false));
  it('requires a headline in either language', () => { expect(sellerListingValid({ ...draft(), headline: '' })).toBe(false); expect(sellerListingValid({ ...draft(), headline: '', headlineTh: 'ธุรกิจโลจิสติกส์' })).toBe(true); });
  it('enforces seven English words for listing names', () => { expect(sellerListingValid({ ...draft(), listingName: Array(7).fill('word').join(' ') })).toBe(true); expect(sellerListingValid({ ...draft(), listingName: Array(8).fill('word').join(' ') })).toBe(false); });
  it('enforces fifteen English words for headlines', () => { expect(sellerListingValid({ ...draft(), headline: Array(15).fill('word').join(' ') })).toBe(true); expect(sellerListingValid({ ...draft(), headline: Array(16).fill('word').join(' ') })).toBe(false); });
  it('enforces fifty Thai characters for listing names', () => { expect(sellerListingValid({ ...draft(), listingName: 'ก'.repeat(50) })).toBe(true); expect(sellerListingValid({ ...draft(), listingName: 'ก'.repeat(51) })).toBe(false); });
  it('enforces one hundred Thai characters for headlines', () => { expect(sellerListingValid({ ...draft(), headlineTh: 'ก'.repeat(100) })).toBe(true); expect(sellerListingValid({ ...draft(), headlineTh: 'ก'.repeat(101) })).toBe(false); });
  it('rejects company identity, websites and contact details', () => { for (const listingName of ['Falcon Logistics', 'www.example.com', 'owner@example.com', '+66 81 234 5678']) expect(sellerListingValid({ ...draft(), name: 'Falcon Co., Ltd.', listingName })).toBe(false); });
  it('maps both headline twins without inventing or overwriting the other language', () => expect(listingPayload({ ...draft(), headlineTh: 'ธุรกิจ' })).toMatchObject({ name: 'Regional Logistics Network', headline: 'Logistics business serving regional customers', headlineTh: 'ธุรกิจ' }));
  it('does not let website enrichment write either identity field', () => { const merged = mergeWebsiteEnrich(emptyDraft(), { listingName: 'Generated', headline: 'Generated', headlineTh: 'สร้าง' }, {}, false); expect(merged.patch.listingName).toBeUndefined(); expect(merged.patch.headline).toBeUndefined(); expect(merged.patch.headlineTh).toBeUndefined(); });
  it('recognizes an already-written listing as answered', () => expect(sellerListingValid(draft())).toBe(true));
});