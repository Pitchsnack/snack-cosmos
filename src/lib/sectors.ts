/**
 * SET / mai sector taxonomy and business-model enum.
 *
 * Single shared definition — referenced by the startup form, the information
 * panel, the directory filters and (later) the peer comparables screen.
 * This is a financial classification for benchmarking. It is NOT a
 * replacement for `industry`, which stays exactly as it is.
 */

export interface SectorGroup {
  group: string;
  sectors: string[];
}

/** Group order is deliberate — by likely use, not alphabetical. */
export const SECTOR_GROUPS: SectorGroup[] = [
  {
    group: "Services",
    sectors: [
      "Commerce",
      "Health Care Services",
      "Media & Publishing",
      "Professional Services",
      "Tourism & Leisure",
      "Transportation & Logistics",
    ],
  },
  {
    group: "Technology",
    sectors: ["Information & Communication Technology", "Electronic Components"],
  },
  { group: "Agro & Food", sectors: ["Agribusiness", "Food & Beverage"] },
  { group: "Financials", sectors: ["Finance & Securities", "Insurance", "Banking"] },
  {
    group: "Consumer Products",
    sectors: ["Fashion", "Home & Office Products", "Personal Products & Pharmaceuticals"],
  },
  {
    group: "Property & Construction",
    sectors: ["Property Development", "Construction Services"],
  },
  {
    group: "Industrials",
    sectors: ["Automotive", "Industrial Materials & Machinery", "Packaging"],
  },
  { group: "Other", sectors: ["Other"] },
];

/** Flat list of the 21 sector values, in group order. */
export const SECTORS: string[] = SECTOR_GROUPS.flatMap((g) => g.sectors);

/** Hints only on the two values people will not guess. */
export const SECTOR_HINTS: Record<string, string> = {
  Commerce: "retail, e-commerce, marketplaces",
  "Information & Communication Technology": "software, SaaS, telecom",
};

export function sectorGroupOf(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return SECTOR_GROUPS.find((g) => g.sectors.includes(sector))?.group ?? null;
}

export function isSector(v: string | null | undefined): boolean {
  return !!v && SECTORS.includes(v);
}

export const BUSINESS_MODELS = [
  {
    value: "operator",
    label: "Operator",
    hint: "runs it with its own assets",
  },
  {
    value: "platform_marketplace",
    label: "Platform / marketplace",
    hint: "takes a cut of others' transactions",
  },
  {
    value: "software_saas",
    label: "Software / SaaS",
    hint: "licenses software to businesses",
  },
  {
    value: "supplier_manufacturer",
    label: "Supplier / manufacturer",
    hint: "sells goods to businesses",
  },
] as const;

export type BusinessModel = (typeof BUSINESS_MODELS)[number]["value"];

export const BUSINESS_MODEL_VALUES = BUSINESS_MODELS.map((b) => b.value) as BusinessModel[];

export function businessModelLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return BUSINESS_MODELS.find((b) => b.value === v)?.label ?? null;
}
