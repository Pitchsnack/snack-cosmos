/**
 * The setup wizards' short list: 16 plain-word types of business, each linked
 * to SET sectors (names exactly as SECTOR_GROUPS stores them).
 */
import { sectorGroupOf } from "@/lib/sectors";

export type TypeKey =
  | "restaurant" | "hotel" | "manufacturing" | "retail" | "wholesale" | "construction" | "agriculture" | "food_processing"
  | "logistics" | "healthcare" | "professional_services" | "technology" | "real_estate" | "education" | "automotive" | "other";

export type BizType = { key: TypeKey; label: string; th: string; icon: string; sector?: string };
export type Kind = { key: string; label: string; th: string; sector: string };

export const BIZ_TYPES: BizType[] = [
  { key: "restaurant", label: "Restaurant / Food Service", th: "ร้านอาหาร / บริการอาหาร", icon: "utensils", sector: "Food & Beverage" },
  { key: "hotel", label: "Hotel / Accommodation", th: "โรงแรม / ที่พัก", icon: "bed", sector: "Tourism & Leisure" },
  { key: "manufacturing", label: "Manufacturing", th: "การผลิต", icon: "factory" },
  { key: "retail", label: "Retail", th: "ค้าปลีก", icon: "shopping-bag", sector: "Commerce" },
  { key: "wholesale", label: "Wholesale / Distribution", th: "ค้าส่ง / จัดจำหน่าย", icon: "package", sector: "Commerce" },
  { key: "construction", label: "Construction", th: "ก่อสร้าง", icon: "hard-hat" },
  { key: "agriculture", label: "Agriculture", th: "เกษตรกรรม", icon: "sprout", sector: "Agribusiness" },
  { key: "food_processing", label: "Food Processing", th: "แปรรูปอาหาร", icon: "cooking-pot", sector: "Food & Beverage" },
  { key: "logistics", label: "Logistics / Transportation", th: "โลจิสติกส์ / ขนส่ง", icon: "truck", sector: "Transportation & Logistics" },
  { key: "healthcare", label: "Healthcare / Clinic", th: "สุขภาพ / คลินิก", icon: "stethoscope", sector: "Health Care Services" },
  { key: "professional_services", label: "Professional Services", th: "บริการวิชาชีพ", icon: "briefcase", sector: "Professional Services" },
  { key: "technology", label: "Technology / Software", th: "เทคโนโลยี / ซอฟต์แวร์", icon: "laptop", sector: "Information & Communication Technology" },
  { key: "real_estate", label: "Real Estate", th: "อสังหาริมทรัพย์", icon: "building-2", sector: "Property Development" },
  { key: "education", label: "Education", th: "การศึกษา", icon: "graduation-cap", sector: "Professional Services" },
  { key: "automotive", label: "Automotive", th: "ยานยนต์", icon: "car", sector: "Automotive" },
  { key: "other", label: "Other", th: "อื่น ๆ", icon: "circle-ellipsis" },
];

/**
 * The app's SET list has no Petrochemicals & Chemicals, Steel and Metal Products,
 * Paper & Printing Materials or Construction Materials: those kinds use the
 * nearest sector the app has.
 */
export const KINDS: Record<"manufacturing" | "construction", Kind[]> = {
  manufacturing: [
    { key: "vehicles", label: "Car parts and vehicles", th: "ชิ้นส่วนรถยนต์และยานยนต์", sector: "Automotive" },
    { key: "machinery", label: "Machinery and industrial materials", th: "เครื่องจักรและวัสดุอุตสาหกรรม", sector: "Industrial Materials & Machinery" },
    { key: "chemicals", label: "Plastics and chemicals", th: "พลาสติกและเคมีภัณฑ์", sector: "Industrial Materials & Machinery" },
    { key: "metal", label: "Steel and metal products", th: "เหล็กและผลิตภัณฑ์โลหะ", sector: "Industrial Materials & Machinery" },
    { key: "packaging", label: "Packaging", th: "บรรจุภัณฑ์", sector: "Packaging" },
    { key: "paper", label: "Paper and printing", th: "กระดาษและการพิมพ์", sector: "Packaging" },
    { key: "textiles", label: "Clothing and textiles", th: "เสื้อผ้าและสิ่งทอ", sector: "Fashion" },
    { key: "home_goods", label: "Furniture and home goods", th: "เฟอร์นิเจอร์และของใช้ในบ้าน", sector: "Home & Office Products" },
    { key: "cosmetics", label: "Cosmetics and medicines", th: "เครื่องสำอางและยา", sector: "Personal Products & Pharmaceuticals" },
    { key: "electronics", label: "Electronics", th: "อิเล็กทรอนิกส์", sector: "Electronic Components" },
    { key: "food", label: "Food and drinks", th: "อาหารและเครื่องดื่ม", sector: "Food & Beverage" },
  ],
  construction: [
    { key: "contracting", label: "Building and contracting", th: "รับเหมาก่อสร้าง", sector: "Construction Services" },
    { key: "materials", label: "Building materials", th: "วัสดุก่อสร้าง", sector: "Construction Services" },
  ],
};

export const hasKinds = (t: string): t is "manufacturing" | "construction" => t === "manufacturing" || t === "construction";
export const typeOf = (k: string) => BIZ_TYPES.find((t) => t.key === k);
export const kindOf = (t: string, k: string | undefined) => (hasKinds(t) ? KINDS[t].find((x) => x.key === k) : undefined);
export const broadSectors = (t: "manufacturing" | "construction") => Array.from(new Set(KINDS[t].map((k) => k.sector)));
export const fullName = (s: string) => `${sectorGroupOf(s) ?? ""} › ${s}`;

/* ------------------------------ Seller: one ------------------------------ */
export type SectorPick = { type: TypeKey; kind?: string };

/** The sector a seller's pick gives (null when it needs a kind, or Other). */
export function pickSector(p: SectorPick | null): string | null {
  if (!p) return null;
  if (hasKinds(p.type)) return kindOf(p.type, p.kind)?.sector ?? null;
  return typeOf(p.type)?.sector ?? null;
}

/* ------------------------- Buyer / advisor: several ------------------------- */
export type SectorPicks = { types: TypeKey[]; kinds: { manufacturing?: string[]; construction?: string[] }; other: string[] };
export const EMPTY_PICKS: SectorPicks = { types: [], kinds: {}, other: [] };

export function normPicks(x: unknown): SectorPicks {
  const o = (x ?? {}) as Partial<SectorPicks>;
  return { types: (o.types ?? []).filter((t) => !!typeOf(t)) as TypeKey[], kinds: o.kinds ?? {}, other: o.other ?? [] };
}

/** Tags in pick order: a broad type with no kind is one tag. */
export function pickTags(p: SectorPicks): { label: string; sectors: string[]; broad?: TypeKey }[] {
  const out: { label: string; sectors: string[]; broad?: TypeKey }[] = [];
  const seen = new Set<string>();
  const add = (s: string) => { if (!seen.has(s)) { seen.add(s); out.push({ label: fullName(s), sectors: [s] }); } };
  for (const t of p.types) {
    if (t === "other") { p.other.forEach(add); continue; }
    if (hasKinds(t)) {
      const ks = p.kinds[t] ?? [];
      if (!ks.length) {
        const all = broadSectors(t);
        all.forEach((s) => seen.add(s));
        out.push({ label: t === "manufacturing" ? "All manufacturing" : "All construction", sectors: all, broad: t });
      } else ks.forEach((k) => { const s = kindOf(t, k)?.sector; if (s) add(s); });
      continue;
    }
    const s = typeOf(t)?.sector;
    if (s) add(s);
  }
  return out;
}

/** The saved industries / sectors, worked out from the picks. No repeats, no limit. */
export const picksToSectors = (p: SectorPicks) => Array.from(new Set(pickTags(p).flatMap((t) => t.sectors)));

/** Review row wording. */
export function picksSummary(p: SectorPicks, th = false) {
  return p.types.map((t) => {
    const name = th ? typeOf(t)!.th : typeOf(t)!.label;
    if (t === "other") return `${name} (${p.other.join(", ")})`;
    if (hasKinds(t)) {
      const ks = (p.kinds[t] ?? []).map((k) => { const x = kindOf(t, k)!; return th ? x.th : x.label; });
      return `${name} (${ks.length ? ks.join(", ") : th ? "ทุกประเภท" : "every kind"})`;
    }
    return name;
  }).join(", ");
}

/** Card chips: broad types with no kind shown as one chip. */
export function sectorChips(sectors: string[], picks: unknown): string[] {
  const p = normPicks(picks);
  if (!p.types.length) return sectors;
  const tags = pickTags(p);
  const covered = new Set(tags.flatMap((t) => t.sectors));
  return [...tags.map((t) => (t.broad ? t.label : t.sectors[0]!)), ...sectors.filter((s) => !covered.has(s))];
}
