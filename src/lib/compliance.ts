/**
 * Regulatory Licenses & International Standards (ISO).
 *
 * Both are multi-value fields on the existing startup record — no separate
 * table. Licence categories are a closed list; ISO standards are a closed list.
 */

export const LICENCE_CATEGORIES = [
  "Financial",
  "Business",
  "Manufacturing",
  "Import & Export",
  "Raw Material",
] as const;

export type LicenceCategory = (typeof LICENCE_CATEGORIES)[number];

export interface RegulatoryLicence {
  category: LicenceCategory;
  name: string;
  number?: string | null;
}

/** Tints used ONLY inside the Regulatory Licenses section. */
export const LICENCE_COLORS: Record<LicenceCategory, { text: string; bg: string; border: string }> = {
  Financial: { text: "#15803D", bg: "#EAF7EE", border: "#CFE8D8" },
  Business: { text: "#1D4ED8", bg: "#EFF4FE", border: "#D3E0FB" },
  Manufacturing: { text: "#B45309", bg: "#FEF3E7", border: "#F6DFB4" },
  "Import & Export": { text: "#6D28D9", bg: "#F4F0FE", border: "#E0D6FA" },
  "Raw Material": { text: "#0E7490", bg: "#E6F6FA", border: "#C7EAF2" },
};

/** Seeded standards with their subject area (shown muted in the combobox). */
export const ISO_SUBJECTS: Record<string, string> = {
  "ISO 9001": "Quality management",
  "ISO 14001": "Environmental",
  "ISO 22000": "Food safety",
  "ISO 22301": "Business continuity",
  "ISO 27001": "Information security",
  "ISO 27701": "Privacy information",
  "ISO 45001": "Occupational H&S",
  "ISO 13485": "Medical devices",
  "ISO 50001": "Energy management",
  "ISO 20000-1": "IT service management",
};

export const ISO_STANDARDS = Object.keys(ISO_SUBJECTS);

/** Trim + collapse double spaces. */
export function normaliseStandard(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, " ");
}

/** Returns an error message or null. */
export function validateStandard(name: string, existing: string[]): string | null {
  const clean = normaliseStandard(name);
  if (!clean) return "Enter a standard.";
  if (existing.some((s) => s.toLowerCase() === clean.toLowerCase()))
    return "That standard is already added.";
  return null;
}

/** Seeded suggestions so the first users pick rather than type. */
export const SEED_LICENCES: Record<LicenceCategory, string[]> = {
  Financial: [
    "BOT — e-Money Licence",
    "BOT — Payment Agent",
    "BOT — Lending Licence",
    "SEC — Securities Brokerage",
    "SEC — Fund Management",
    "OIC — Insurance Broker",
  ],
  Business: [
    "DBD — e-Commerce Registration",
    "BOI — Promoted Activity",
    "NBTC — Telecom Type 1",
    "DIP — Trademark Registration",
    "Revenue — VAT Registration",
  ],
  Manufacturing: [
    "Thai FDA — Food Manufacturing",
    "Thai FDA — Medical Device Manufacturing",
    "DIW — Factory Licence Type 3",
    "TISI — TIS Certification",
    "MoPH — Cosmetics Manufacturing",
  ],
  "Import & Export": [
    "Customs — Authorised Economic Operator",
    "DFT — Export Licence",
    "Thai FDA — Import Licence (Food)",
    "DOA — Plant Quarantine Import Permit",
  ],
  "Raw Material": [
    "DOA — Fertiliser Registration",
    "DIW — Hazardous Substance Type 3",
    "DLD — Animal Feed Licence",
    "DOF — Fishery Product Licence",
  ],
};

/** A tag naming only a regulator says who issues, not what is held. */
const REGULATOR_ONLY = new Set([
  "bot", "sec", "oic", "nbtc", "boi", "dbd", "dip", "diw", "tisi", "moph",
  "doa", "dld", "dof", "dft", "customs", "revenue", "fda", "thai fda",
]);

export function normaliseLicenceName(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, " ");
}

export function isRegulatorOnly(name: string): boolean {
  const n = normaliseLicenceName(name).toLowerCase().replace(/[.\-—–]/g, " ").replace(/\s{2,}/g, " ").trim();
  return REGULATOR_ONLY.has(n);
}

/** Validates a licence before it is added. Returns an error message or null. */
export function validateLicence(
  category: string,
  name: string,
  existing: RegulatoryLicence[],
): string | null {
  if (!LICENCE_CATEGORIES.includes(category as LicenceCategory)) return "Choose a category.";
  const clean = normaliseLicenceName(name);
  if (!clean) return "Enter a licence name.";
  if (isRegulatorOnly(clean))
    return `"${clean}" names only the regulator. Enter the licence itself, e.g. "${clean} — e-Money Licence".`;
  if (existing.some((l) => l.category === category && l.name.toLowerCase() === clean.toLowerCase()))
    return "That licence is already added for this category.";
  return null;
}

const ORDER: Record<LicenceCategory, number> = {
  Financial: 0,
  Business: 1,
  Manufacturing: 2,
  "Import & Export": 3,
  "Raw Material": 4,
};

/** Same-category pills adjacent, fixed category order, alphabetical within. */
export function sortLicences(list: RegulatoryLicence[]): RegulatoryLicence[] {
  return [...list].sort(
    (a, b) =>
      (ORDER[a.category] ?? 99) - (ORDER[b.category] ?? 99) ||
      a.name.localeCompare(b.name),
  );
}

/** Defensive parse of the stored jsonb value. */
export function parseLicences(value: unknown): RegulatoryLicence[] {
  if (!Array.isArray(value)) return [];
  const out: RegulatoryLicence[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const category = String(r.category ?? "");
    const name = normaliseLicenceName(String(r.name ?? ""));
    if (!name || !LICENCE_CATEGORIES.includes(category as LicenceCategory)) continue;
    const num = r.number == null ? null : String(r.number).trim() || null;
    out.push({ category: category as LicenceCategory, name, number: num });
  }
  return out;
}
