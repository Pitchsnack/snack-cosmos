/** Profile handover: the parts an owner checks, per kind (brief section 1). Client-safe. */
export type HandoverKind = "startup" | "investor" | "firm";
export type RunBy = "none" | "owner" | "pitchsnack";

export type PartDef = {
  key: string;
  view: "public" | "private" | "open";
  en: string;
  th: string;
  /** Fields compared against the prepared snapshot: "table.column" (list = names of child rows). */
  fields: { src: string; label: string; list?: boolean }[];
  /** Where Edit information opens. */
  edit: { view?: "public" | "private"; tab?: string; section?: string };
};

const f = (src: string, label: string, list = false) => ({ src, label, list });

export const PARTS: Record<HandoverKind, PartDef[]> = {
  startup: [
    { key: "identity", view: "public", en: "Anonymous Identity", th: "ตัวตนแบบไม่ระบุชื่อ", fields: [f("hp.code_name", "Code name"), f("hp.region", "Region")], edit: { view: "public", tab: "identity" } },
    { key: "description", view: "public", en: "Public Description", th: "คำอธิบายสาธารณะ", fields: [f("hp.headline", "Headline"), f("hp.description", "Description"), f("hp.highlights", "Highlights"), f("hp.customers_summary", "Customers")], edit: { view: "public", tab: "description", section: "headline" } },
    { key: "deal", view: "public", en: "Deal Terms", th: "เงื่อนไขดีล", fields: [f("hp.asking_price_thb", "Asking price"), f("hp.stake_pct", "Stake"), f("hp.deal_type", "Deal type"), f("hp.structure", "Structure"), f("hp.reason", "Reason for sale"), f("hp.handover", "Handover"), f("hp.owner_stays", "Owner stays"), f("hp.handover_months", "Handover months")], edit: { view: "public", tab: "deal", section: "deal" } },
    { key: "images", view: "private", en: "Images & Logo", th: "รูปภาพและโลโก้", fields: [f("s.logo_url", "Logo"), f("media", "Photos", true)], edit: { view: "private", tab: "images", section: "media" } },
    { key: "about", view: "private", en: "About Company", th: "เกี่ยวกับบริษัท", fields: [f("s.website_url", "Website"), f("s.city", "City"), f("s.year_founded", "Year founded"), f("s.company_size", "Company size"), f("s.last_year_revenue", "Revenue"), f("s.short_description", "Short description"), f("s.long_description", "Description"), f("s.email", "Email"), f("founders", "Founders", true)], edit: { view: "private", tab: "about", section: "description" } },
    { key: "market", view: "private", en: "Industry & Market", th: "อุตสาหกรรมและตลาด", fields: [f("s.sector", "Sector"), f("s.industry", "Industry"), f("s.business_model", "Business model"), f("s.product_tags", "Product tags"), f("s.market_tags", "Market tags")], edit: { view: "private", tab: "market" } },
    { key: "licenses", view: "private", en: "Licenses", th: "ใบอนุญาต", fields: [f("s.regulatory_licenses", "Licences"), f("s.iso_standards", "ISO standards")], edit: { view: "private", tab: "licenses", section: "licenses" } },
  ],
  investor: [
    { key: "fund", view: "public", en: "Fund & ticket", th: "กองทุนและขนาดเงินลงทุน", fields: [f("i.ticket_band", "Average investment"), f("i.aum_band", "Assets under management"), f("i.deal_size_band", "Deal size")], edit: { section: "fund" } },
    { key: "buying", view: "public", en: "Buying requirement", th: "ความต้องการซื้อ", fields: [f("i.preferred_industries", "Industries"), f("i.preferred_stages", "Stages"), f("i.revenue_min_band", "Revenue minimum")], edit: { section: "industries" } },
    { key: "mandate", view: "public", en: "Mandate", th: "ขอบเขตการลงทุน", fields: [f("i.investment_focus", "Focus"), f("i.keywords", "Keywords"), f("bp.deal_types", "Deal types"), f("bp.geography", "Geography")], edit: { section: "mandate" } },
    { key: "pubdesc", view: "public", en: "Public description", th: "คำอธิบายสาธารณะ", fields: [f("i.short_description", "Short description"), f("bp.headline", "Headline"), f("bp.description", "Description")], edit: { section: "description" } },
    { key: "company", view: "private", en: "Company details", th: "ข้อมูลบริษัท", fields: [f("i.investor_name", "Name"), f("i.legal_name", "Legal name"), f("i.website_url", "Website"), f("i.year_founded", "Year founded"), f("i.company_size_band", "Company size"), f("i.registration_no", "Registration number"), f("i.address_line1", "Address"), f("i.address_province_state", "Province")], edit: { section: "classification", view: "private" } },
    { key: "verify", view: "private", en: "Verification and decision makers", th: "การยืนยันตัวตนและผู้มีอำนาจตัดสินใจ", fields: [f("bp.people", "Decision makers"), f("bp.decision_process", "Decision process")], edit: { section: "people", view: "private" } },
  ],
  firm: [
    { key: "firm", view: "open", en: "Firm", th: "บริษัท", fields: [f("af.name", "Name"), f("af.year_founded", "Year founded"), f("af.description", "Description"), f("af.logo_path", "Logo")], edit: { section: "firm" } },
    { key: "services", view: "open", en: "Services and fees", th: "บริการและค่าธรรมเนียม", fields: [f("af.services", "Services"), f("af.deal_size_band", "Deal size")], edit: { section: "services" } },
    { key: "work", view: "open", en: "Work", th: "ผลงาน", fields: [f("af.sectors", "Sectors"), f("af.languages", "Languages")], edit: { section: "work" } },
    { key: "company", view: "open", en: "Company", th: "ข้อมูลบริษัท", fields: [f("af.legal_name", "Legal name"), f("af.registration_no", "Registration number"), f("af.addr_street", "Address"), f("af.addr_province", "Province"), f("af.website", "Website"), f("af.email", "Email"), f("af.phone", "Phone")], edit: { section: "company" } },
    { key: "team", view: "open", en: "Team", th: "ทีมงาน", fields: [f("team", "Team", true)], edit: { section: "team" } },
    { key: "credentials", view: "open", en: "Licences and credentials", th: "ใบอนุญาตและคุณวุฒิ", fields: [f("credentials", "Licences", true)], edit: { section: "credentials" } },
    { key: "documents", view: "open", en: "Documents", th: "เอกสาร", fields: [f("documents", "Documents", true)], edit: { section: "documents" } },
  ],
};

export const VIEW_LABEL = {
  startup: { public: ["Public view", "มุมมองสาธารณะ", "what buyers see before an NDA", "สิ่งที่ผู้ซื้อเห็นก่อน NDA"], private: ["Private view", "มุมมองส่วนตัว", "shared after you approve an NDA", "แชร์หลังท่านอนุมัติ NDA"] },
  investor: { public: ["Public view", "มุมมองสาธารณะ", "what sellers see before an NDA", "สิ่งที่ผู้ขายเห็นก่อน NDA"], private: ["Private view", "มุมมองส่วนตัว", "shared after a seller approves your NDA", "แชร์หลังผู้ขายอนุมัติ NDA ของท่าน"] },
  firm: { open: ["Open to sellers and buyers", "เปิดให้ผู้ขายและผู้ซื้อ", "", ""] },
} as const;

export const KIND_WORD = {
  startup: { profile: "company", dir: "startups", place: "the Marketplace", role: "seller", what: "business", plural: "companies" },
  investor: { profile: "investor profile", dir: "investors", place: "Browse investors", role: "buyer", what: "investor", plural: "investors" },
  firm: { profile: "firm profile", dir: "advisor firms", place: "Browse advisors", role: "advisor", what: "firm", plural: "advisor firms" },
} as const;

export const RELATIONS: Record<"startup" | "investor", { value: string; en: string; hint?: string }[]> = {
  startup: [
    { value: "owner", en: "Business owner", hint: "I am selling my own company" },
    { value: "family", en: "Family business owner", hint: "I am selling or considering the sale of my family business" },
    { value: "agent", en: "Authorized representative / agent", hint: "I am acting on behalf of the owner" },
  ],
  investor: [
    { value: "individual", en: "Individual Investor" },
    { value: "corporate", en: "Corporate Enterprise" },
    { value: "agent", en: "Authorised representative / adviser" },
  ],
};

export function relationLabel(kind: HandoverKind, v: string | null | undefined) {
  if (!v) return null;
  if (kind === "firm") return v;
  return RELATIONS[kind].find((r) => r.value === v)?.en ?? v;
}

export const DEFAULT_TEAM = "PitchSnack team";
export const teamName = (s: string | null | undefined) => (s && s.trim() ? s.trim() : DEFAULT_TEAM);
