/**
 * Basic Information Restrictions — shared client store + adaptive masking.
 *
 * The founder configures which basic fields are hidden from non-authorized
 * users (see BasicInformationRestrictionsTab). Restriction settings are stored
 * per module scope so My Startups and the Startup Directory stay independent.
 *
 * Persistence is client-side (localStorage) because no approved backend
 * restriction contract exists yet. Masking here is applied to every rendered
 * surface (cards, rows, split view, panels) so restricted values are never
 * displayed to non-authorized viewers.
 *
 * Adaptive masking rules (see Adaptive_Visual_Masking_Restricted_Content):
 * - text values are replaced with word-shaped masking (same word lengths,
 *   spacing and line breaks), never with the original characters;
 * - string arrays (pills/tags) keep one masked entry per pill;
 * - images / URLs / emails are dropped entirely (null) and the UI renders a
 *   pixelated mosaic placeholder preserving the original box;
 * - MISSING values are left untouched — a missing value is never treated as a
 *   restricted value, so existing empty-state behaviour is unchanged.
 */

export type RestrictionsScope = "startups" | "my-startups";

export type RestrictionMap = Record<string, boolean>;

export const RESTRICTED_PLACEHOLDER = "Restricted";

/** Block character used for word-shaped masking. */
export const MASK_CHAR = "\u2592";

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

/**
 * Word-shaped masking: every word keeps its length, spaces / newlines / simple
 * punctuation keep their position so the sentence and paragraph flow survives.
 * No original letter, digit or symbol carrying meaning is preserved.
 */
export function maskText(value: string): string {
  return value.replace(/[^\s]/g, MASK_CHAR);
}

/** Fields dropped completely (images, URLs, contact identifiers). */
const DROPPED_FIELDS = new Set([
  "logo_signed_url",
  "logo_url",
  "tile_image_signed_url",
  "media",
  "media_images",
  "website_url",
  "linkedin_url",
  "email",
  "photo_url",
  "photo_signed_url",
]);

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
  investors: ["related_investors", "investors"],
};

type FounderLike = Record<string, unknown>;

/** Masks founder name / role / bio and removes picture, LinkedIn and contacts. */
function maskFounder(f: FounderLike): FounderLike {
  const next: FounderLike = { ...f };
  for (const key of ["full_name", "position", "bio", "role", "title"]) {
    const v = next[key];
    if (typeof v === "string" && v.trim() !== "") next[key] = maskText(v);
  }
  for (const key of ["photo_url", "photo_signed_url", "linkedin_url", "email", "phone"]) {
    if (key in next && next[key] != null) next[key] = null;
  }
  next.masked = true;
  return next;
}

/** Masks investor / relationship chips while keeping each chip separate. */
function maskNamed(entry: unknown): unknown {
  if (typeof entry === "string") return maskText(entry);
  if (entry && typeof entry === "object") {
    const next = { ...(entry as Record<string, unknown>) };
    for (const key of ["name", "investor_name", "full_name", "label"]) {
      const v = next[key];
      if (typeof v === "string" && v.trim() !== "") next[key] = maskText(v);
    }
    next.masked = true;
    return next;
  }
  return entry;
}

function maskValue(field: string, current: unknown): unknown {
  if (current == null) return current; // missing value → unchanged
  if (field === "media" || field === "media_images") {
    // Keep the slots so the gallery layout survives, but drop every URL/caption.
    return Array.isArray(current)
      ? current.map((m) => ({
          ...(m as Record<string, unknown>),
          image_signed_url: null,
          image_url: null,
          caption: null,
          masked: true,
        }))
      : null;
  }
  if (DROPPED_FIELDS.has(field)) return Array.isArray(current) ? [] : null;

  if (Array.isArray(current)) {
    if (current.length === 0) return current; // missing value → unchanged
    if (field === "founders") return current.map((f) => maskFounder(f as FounderLike));
    if (field === "related_investors" || field === "investors") return current.map(maskNamed);
    return current.map((v) => (typeof v === "string" ? maskText(v) : maskNamed(v)));
  }

  if (typeof current === "string") return current.trim() === "" ? current : maskText(current);
  if (typeof current === "number") return maskText(String(current));
  return null;
}

/**
 * Returns a copy of the record with restricted fields adaptively masked.
 * The original values are replaced in the data itself (not visually hidden),
 * so unauthorized surfaces never receive them — no tooltip, alt text,
 * accessibility label, link, hidden node or clipboard copy can recover them.
 */
export function maskRestricted<T extends object>(
  item: T,
  restrictions: RestrictionMap,
): T & { restricted_fields: string[] } {
  const restrictedKeys = Object.keys(restrictions).filter((k) => restrictions[k]);
  if (restrictedKeys.length === 0) return { ...item, restricted_fields: [] };

  const next: Record<string, unknown> = { ...(item as Record<string, unknown>) };
  for (const key of restrictedKeys) {
    for (const field of FIELD_MAP[key] ?? [key]) {
      if (!(field in next)) continue;
      next[field] = maskValue(field, next[field]);
    }
  }
  next.restricted_fields = restrictedKeys;
  return next as T & { restricted_fields: string[] };
}
