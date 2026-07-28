/**
 * Approved public field allowlist for directory publication (PRD §9).
 *
 * DEFENCE IN DEPTH ONLY. This projection exists so the frontend never *sends*
 * private data. It is NOT the privacy boundary: the future backend publication
 * service remains the authoritative field-validation and privacy authority.
 *
 * Private notes, internal activity, restricted fields, founder-only documents,
 * private contact details, ownership internals, AI ownership data, tenant
 * analysis, audit data and credentials are never included here.
 */
import type { DirectoryProjection, StartupRef } from "./types";

type ProjectionSource = {
  id: string;
  startup_name: string;
  logo_url?: string | null;
  short_description?: string | null;
  industry?: string[] | null;
  product_tags?: string[] | null;
  market_tags?: string[] | null;
  headquarters?: string | null;
  city?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  investment_stage?: string | null;
};

/** Build the allowlisted directory projection for a founder-owned startup. */
export function toDirectoryProjection(source: ProjectionSource): DirectoryProjection {
  const startup_ref: StartupRef = source.id;
  return {
    startup_ref,
    name: source.startup_name,
    logo_url: source.logo_url ?? null,
    short_description: source.short_description ?? null,
    industry: source.industry ?? [],
    product_tags: source.product_tags ?? [],
    market_tags: source.market_tags ?? [],
    location: source.headquarters ?? source.city ?? null,
    website_url: source.website_url ?? null,
    linkedin_url: source.linkedin_url ?? null,
    investment_stage: source.investment_stage ?? null,
  };
}

/** Field names the projection is allowed to emit. Used by tests/reviews. */
export const DIRECTORY_PROJECTION_ALLOWLIST = [
  "startup_ref",
  "name",
  "logo_url",
  "short_description",
  "industry",
  "product_tags",
  "market_tags",
  "location",
  "website_url",
  "linkedin_url",
  "investment_stage",
] as const;
