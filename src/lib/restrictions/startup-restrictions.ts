/**
 * Basic Information Restrictions — shared client store + masking.
 *
 * The founder configures which basic fields are hidden from non-authorized
 * users (see BasicInformationRestrictionsTab). Restriction settings are stored
 * per module scope so My Startups and the Startup Directory stay independent.
 *
 * Persistence is client-side (localStorage) because no approved backend
 * restriction contract exists yet. Masking here is applied to every rendered
 * surface (cards, rows, split view, panels) so restricted values are never
 * displayed to non-authorized viewers.
 */

export type RestrictionsScope = "startups" | "my-startups";

export type RestrictionMap = Record<string, boolean>;

export const RESTRICTED_PLACEHOLDER = "Restricted";

const STORAGE_KEY = (scope: RestrictionsScope, id: string) =>
  `sp2.basic-info-restrictions.${scope}.${id}`;

export const RESTRICTIONS_CHANGE_EVENT = "sp2:basic-info-restrictions:change";

export function loadRestrictions(scope: RestrictionsScope, id: string): RestrictionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(scope, id));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as RestrictionMap) : {};
  } catch {
    return {};
  }
}

export function saveRestrictions(scope: RestrictionsScope, id: string, r: RestrictionMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY(scope, id), JSON.stringify(r));
  window.dispatchEvent(new CustomEvent(RESTRICTIONS_CHANGE_EVENT));
}

export function subscribeToRestrictions(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(RESTRICTIONS_CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(RESTRICTIONS_CHANGE_EVENT, cb);
  };
}

/** Shape needed to decide whether the current viewer is authorized. */
export interface RestrictableOwnership {
  id: string;
  owning_agent?: { id: string } | null;
  owning_ai_agent?: { id: string } | null;
}

/**
 * Founders/owners of the startup and CONTROL principals always see the real
 * values. Everyone else sees placeholders for restricted fields.
 */
export function isAuthorizedViewer(
  item: RestrictableOwnership,
  viewerId: string | null,
  isControl: boolean,
): boolean {
  if (isControl) return true;
  if (!viewerId) return false;
  return item.owning_agent?.id === viewerId || item.owning_ai_agent?.id === viewerId;
}

/** Maps restriction keys to the DTO fields they cover. */
const FIELD_MAP: Record<string, string[]> = {
  logo: ["logo_signed_url", "logo_url"],
  media_images: ["tile_image_signed_url", "media", "media_images"],
  startup_name: ["startup_name"],
  legal_name: ["legal_name"],
  company_type: ["company_type"],
  investment_stage: ["investment_stage"],
  year_founded: ["year_founded"],
  headquarters: ["headquarters"],
  country: ["country", "region"],
  city: ["city"],
  industry: ["industry"],
  short_description: ["short_description"],
  long_description: ["long_description"],
  website_url: ["website_url"],
  linkedin_url: ["linkedin_url"],
  product_tags: ["product_tags"],
  market_tags: ["market_tags"],
  founders: ["founders"],
  investors: ["related_investors"],
};

/** Fields where a placeholder string is shown instead of dropping the value. */
const PLACEHOLDER_FIELDS = new Set(["startup_name"]);

/**
 * Returns a copy of the record with restricted fields redacted.
 * Values are removed from the object entirely (not visually hidden), so the
 * actual data is never handed to a non-authorized surface.
 */
export function maskRestricted<T extends Record<string, unknown>>(
  item: T,
  restrictions: RestrictionMap,
): T & { restricted_fields: string[] } {
  const restrictedKeys = Object.keys(restrictions).filter((k) => restrictions[k]);
  if (restrictedKeys.length === 0) return { ...item, restricted_fields: [] };

  const next: Record<string, unknown> = { ...item };
  for (const key of restrictedKeys) {
    for (const field of FIELD_MAP[key] ?? [key]) {
      if (!(field in next)) continue;
      const current = next[field];
      if (Array.isArray(current)) next[field] = [];
      else if (PLACEHOLDER_FIELDS.has(field)) next[field] = RESTRICTED_PLACEHOLDER;
      else next[field] = null;
    }
  }
  next.restricted_fields = restrictedKeys;
  return next as T & { restricted_fields: string[] };
}
