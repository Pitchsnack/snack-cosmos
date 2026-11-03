import { suggestHighlights, type ListingSource } from './public-listing';
import type { SellerDraft } from './seller-wizard';

export const STRENGTH_MAX = 200;
export const strengthRows = (rows?: (string | null)[] | null): string[] => Array.from({ length: 4 }, (_, i) => rows?.[i] ?? '');
export const displayedStrengths = (d: Pick<SellerDraft, 'highlights' | 'highlightsTh'>, th: boolean) => {
  const own = strengthRows(th ? d.highlightsTh : d.highlights);
  const other = strengthRows(th ? d.highlights : d.highlightsTh);
  return own.map((text, i) => text.trim() ? text : other[i] ?? '');
};
export const strengthCount = (d: Pick<SellerDraft, 'highlights' | 'highlightsTh'>, requiredOnly = false) => displayedStrengths(d, false).slice(0, requiredOnly ? 3 : 4).filter(text => text.trim()).length;

/** Use the existing anonymous suggestion builder; no website fetch, AI or new storage. */
export function wizardStrengthIdeas(d: SellerDraft, th: boolean): string[] {
  const r = d.enrichResult ?? {};
  const source: ListingSource = {
    startup_name: d.name, website_url: d.web, sector: d.sector,
    city: d.addr.province || d.city, headquarters: 'Thailand',
    year_founded: d.year ? Number(d.year) : null, company_size: d.size, last_year_revenue: d.rev,
    short_description: (th ? d.shortDescriptionTh || d.shortDescription : d.shortDescription || d.shortDescriptionTh) ?? '',
    long_description: (th ? d.longDescriptionTh || d.longDescription : d.longDescription || d.longDescriptionTh) ?? '',
    product_tags: th ? d.productTagsTh?.length ? d.productTagsTh : d.productTags : d.productTags?.length ? d.productTags : d.productTagsTh,
    market_tags: th ? d.marketTagsTh?.length ? d.marketTagsTh : d.marketTags : d.marketTags?.length ? d.marketTags : d.marketTagsTh,
    iso_standards: d.iso.length ? d.iso : Array.isArray(r.isoStandards) ? r.isoStandards.filter((v): v is string => typeof v === 'string') : [],
    regulatory_licenses: d.licences,
    people: d.founders?.map(f => f.full_name),
    registered_name: typeof r.registeredName === 'string' ? r.registeredName : null,
    email: typeof r.email === 'string' ? r.email : null,
  };
  return suggestHighlights(source, { language: th ? 'th' : 'en' }).map(text => text.trim().slice(0, STRENGTH_MAX)).filter(Boolean);
}

/** Blank means blank in both languages; preserve all entered rows and optional row four. */
export function fillEmptyStrengths(d: Pick<SellerDraft, 'highlights' | 'highlightsTh'>, ideas: string[], th: boolean) {
  const rows = strengthRows(th ? d.highlightsTh : d.highlights);
  const shown = displayedStrengths(d, th);
  const used = new Set([...strengthRows(d.highlights), ...strengthRows(d.highlightsTh)].map(text => text.trim().toLocaleLowerCase()).filter(Boolean));
  const pool = ideas.map(text => text.trim()).filter(text => text && !used.has(text.toLocaleLowerCase()));
  let first = -1;
  for (let i = 0; i < 3; i++) {
    if (shown[i]?.trim()) continue;
    const idea = pool.find(text => !used.has(text.toLocaleLowerCase()));
    if (!idea) continue;
    rows[i] = idea; used.add(idea.toLocaleLowerCase());
    if (first === -1) first = i;
  }
  return { rows, first };
}