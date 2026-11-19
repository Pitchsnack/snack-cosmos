import { suggestBusinessDescription, suggestCodeNameFor, suggestHeadline, type ListingSource } from "./public-listing";

export type SellerListingAnswers = {
  name: string;
  registeredName?: string;
  web: string;
  city: string;
  year: string;
  size: string | null;
  rev: string | null;
  sector: string | null;
  productTags?: string[];
  marketTags?: string[];
  productTagsTh?: string[];
  marketTagsTh?: string[];
  licences?: { name: string }[];
  iso?: string[];
  listingName?: string;
  headline?: string;
  headlineTh?: string;
  description?: string;
  descriptionTh?: string;
};

export function sellerListingSource(d: SellerListingAnswers): ListingSource {
  return {
    startup_name: d.name,
    registered_name: d.registeredName || null,
    website_url: d.web || null,
    city: d.city || null,
    headquarters: "Thailand",
    year_founded: /^\d{4}$/.test(d.year) ? Number(d.year) : null,
    company_size: d.size,
    last_year_revenue: d.rev,
    sector: d.sector,
    product_tags: d.productTags?.length ? d.productTags : d.productTagsTh ?? [],
    market_tags: d.marketTags?.length ? d.marketTags : d.marketTagsTh ?? [],
    regulatory_licenses: d.licences ?? [],
    iso_standards: d.iso ?? [],
  };
}

/** Validation/preview fallback only; authorised server saving writes the actual generated text. */
export function withAutomaticSellerListingText<T extends SellerListingAnswers>(d: T): T {
  const source = sellerListingSource(d);
  return {
    ...d,
    listingName: d.listingName?.trim() || suggestCodeNameFor(source),
    headline: d.headline?.trim() || d.headlineTh?.trim() ? d.headline : suggestHeadline(source),
    description: d.description?.trim() || d.descriptionTh?.trim() ? d.description : suggestBusinessDescription(source),
  };
}
