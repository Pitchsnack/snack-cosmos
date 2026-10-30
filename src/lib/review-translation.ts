/**
 * Admin › Approvals review › Translation: browser-safe row model and counting
 * rules, shared by the review UI, its server builder and tests.
 */
export const TR_KEYS = ["company_name", "address", "person_name", "person_title", "published_headline", "suggested_headline", "description", "highlights", "customers", "owner_bio"] as const;
export type TrKey = (typeof TR_KEYS)[number];
export type TrRow = {
  key: TrKey;
  group: "company" | "texts";
  label: string;
  en: string;
  th: string;
  /** One item per line (highlights). */
  list?: boolean;
  /** English comes from elsewhere and is shown read-only (e.g. the account name). */
  enLocked?: boolean;
  max: number;
  multiline?: boolean;
};
export type TrState = "both" | "no_th" | "no_en" | "empty";

export const TR_MAX: Record<TrKey, number> = {
  company_name: 200, address: 500, person_name: 120, person_title: 120,
  published_headline: 120, suggested_headline: 120, description: 3000, highlights: 200, customers: 3000, owner_bio: 3000,
};

export const hasThai = (s: string | null | undefined) => /[\u0E00-\u0E7F]/.test(s ?? "");
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function rowState(r: Pick<TrRow, "en" | "th" | "list">): TrState {
  if (r.list) {
    const en = lines(r.en), th = lines(r.th);
    if (!en.length && !th.length) return "empty";
    if (en.length && th.length < en.length) return "no_th";
    if (!en.length || en.length < th.length) return "no_en";
    return "both";
  }
  const en = r.en.trim(), th = r.th.trim();
  if (!en && !th) return "empty";
  if (!th) return "no_th";
  if (!en) return "no_en";
  return "both";
}

/** Rows counted on the Translation tab: anything not In both (empty rows have nothing to translate). */
export function trCounts(rows: Pick<TrRow, "en" | "th" | "list">[]) {
  let both = 0, noTh = 0, noEn = 0;
  for (const r of rows) {
    const s = rowState(r);
    if (s === "both") both++; else if (s === "no_th") noTh++; else if (s === "no_en") noEn++;
  }
  return { both, noTh, noEn, open: noTh + noEn };
}

/** Setup language: stored on the account; older accounts fall back to the language most English fields are written in. */
export function setupLanguageOf(stored: string | null | undefined, rows: Pick<TrRow, "en">[]): "en" | "th" {
  if (stored === "en" || stored === "th") return stored;
  const filled = rows.map((r) => r.en.trim()).filter(Boolean);
  const thai = filled.filter(hasThai).length;
  return thai > filled.length - thai ? "th" : "en";
}
