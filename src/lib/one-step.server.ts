/**
 * One-step approval (server-only): queue + review assembly for Admin ›
 * Approvals, shared by sellers, buyers and advisors. DBD comparison data comes
 * from the shared registration-keyed store only. Missing stored facts are
 * checked by hand; opening the review never extracts DBD data.
 */

export type OneStepKind = "seller" | "buyer" | "advisor";

export type ReviewRow = {
  key: string;
  label: string;
  from: string | null; // what the user gave (null = Not given)
  found: string | null; // what PitchSnack found (null = Check by hand / Nothing to open)
  source: string | null; // "DBD register" · "DBD financial statements" · "Link check"
  result: "match" | "differs" | "by_hand" | "not_needed" | "not_given";
  resultLabel: string | null; // e.g. "Is a director", "Below the range"
  link: string | null; // "Open the site" target
  checked: boolean; // Admin marked a by-hand row checked
};

export type OneStepReview = {
  registrationNo: string | null;
  dbd: StoreState;
  individual: boolean;
  listingRows: [string, string][]; // Listing view rows (label, value)
  identityWords: string[]; // identity check findings ([] = clean; null row for advisors)
  identityApplies: boolean;
  exclusiveRows: { label: string; value: string; note: string | null }[];
  verification: ReviewRow[];
  email: string | null;
  phone: string | null;
  personName?: string | null;
  personTitle?: string | null;
  directory: string;
  directoryId: string | null;
  card: {
    ref: string; type: string | null; place: string | null; description: string | null;
    figs: [string, string][]; realName: string | null; website: string | null; address: string | null;
    founded: string | null; contact: string | null; sector: string | null; city: string | null;
  };
};

export type OneStepItem = {
  kind: OneStepKind;
  id: string;
  ref: string;
  name: string;
  type: string | null;
  place: string | null;
  person: string | null;
  decisionNote?: string | null;
  submittedAt: string | null;
  sentBackAt: string | null;
  chip: "waiting" | "sent_back";
  suggestedName: string | null;
  suggestedHeadline: string | null;
  publishedName: string | null;
  publishedHeadline: string | null;
  review: OneStepReview;
};

/* ------------------------------------------------------------- helpers */

export { REVENUE_BANDS, revenueBandLabel } from "@/lib/revenue-bands";
import { REVENUE_BANDS, revenueBandLabel } from "@/lib/revenue-bands";
import { handoverLine } from "@/lib/hidden-profile";
import { PRICE_BANDS, bandOf, thbOf } from "@/lib/asking-price";

/** The stored band key as the buyer-facing range text, or the amount's own range. */
export const priceLabel = (hp: any) =>
  (PRICE_BANDS.find((b) => b.key === hp?.asking_price_band) ?? bandOf(thbOf(hp)))?.label ?? null;

/** Case/punctuation/space-insensitive compare, Thai-aware. */
export const normText = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();

const sameText = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normText(a), nb = normText(b);
  return !!na && !!nb && na === nb;
};

export const waitingDays = (iso: string | null | undefined) => {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  if (!iso || !Number.isFinite(Date.parse(iso))) return 0;
  return Math.max(0, Math.round((Date.parse(day(new Date())) - Date.parse(day(new Date(iso)))) / 86_400_000));
};

/** Only public HTTP(S) destinations are checked; each redirect is revalidated. */
export function publicWebsite(value: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || (u.port && !['80','443'].includes(u.port))) return null;
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') || host.endsWith('.test') || host.includes(':') || /^[\d.]+$/.test(host)) return null;
    return u;
  } catch { return null; }
}
export async function checkWebsite(url: string | null | undefined): Promise<"works" | "dead" | "none" | "unchecked"> {
  if (!url?.trim()) return "none";
  if (!publicWebsite(url.trim())) return "dead";
  // DNS preflight followed by fetch cannot pin the destination in this runtime:
  // fail closed rather than permit DNS rebinding into internal services.
  return "unchecked";
}

type DbdFacts = import("./dbd-store.server").DbdFacts & { manual?: boolean };
type StoreState = import("./dbd-store.server").DbdStoreState;

/** Reads the shared DBD store only — opening a review never fetches from DBD. */
async function dbdFromStore(sb: any, reg: string | null | undefined): Promise<{ facts: DbdFacts | null; state: StoreState }> {
  const { storeState, factsFromData } = await import("./dbd-store.server");
  const { state, data } = await storeState(sb, reg);
  const f = data ? factsFromData(data) : null;
  return { facts: f ? { ...f, manual: state.source === "manual" } : null, state };
}

const yearOf = (iso: string | null | undefined) => {
  if (!iso) return null;
  const m = String(iso).match(/(\d{4})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y > 2400) y -= 543; // Buddhist year in the source
  return y;
};

const fmtM = (m: number) => `฿${m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)}B` : `${Math.round(m)}M`}`;

export function nameRow(label: string, from: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const found = dbd ? [dbd.nameEn, dbd.nameTh].filter(Boolean).join(" / ") || null : null;
  const hasName = !!(dbd?.nameEn || dbd?.nameTh);
  const match = dbd && (sameText(from, dbd.nameEn) || sameText(from, dbd.nameTh));
  return {
    key: "name", label, from, found: found ?? "Check by hand", source: dbd ? (dbd.manual ? "Entered by hand" : "DBD register") : null,
    result: !from ? "not_given" : !hasName ? "by_hand" : match ? "match" : "differs",
    resultLabel: !from ? "Differs" : !hasName ? "By hand" : match ? "Matches" : "Differs",
    link: null, checked,
  };
}

function addressRow(from: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  return {
    key: "address", label: "Address", from, found: dbd?.address ?? "Check by hand", source: dbd?.address ? (dbd.manual ? "Entered by hand" : "DBD register") : null,
    result: !from ? "not_given" : !dbd?.address ? "by_hand" : sameText(from, dbd.address) ? "match" : "differs",
    resultLabel: !from ? "Differs" : !dbd?.address ? "By hand" : sameText(from, dbd.address) ? "Matches" : "Differs",
    link: null, checked,
  };
}

function yearRow(from: string | null, storyYear: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const regYear = yearOf(dbd?.registeredOn);
  const userYear = yearOf(from);
  const storyY = yearOf(storyYear);
  const both = storyY ? `${from ?? "Not given"} · the owner's story: ${storyYear}` : from;
  const match = regYear != null && userYear != null && regYear === userYear && (storyY == null || storyY === regYear);
  return {
    key: "year", label: "Year founded", from: both, found: dbd?.registeredOn ? `Registered on ${dbd.registeredOn}` : "Check by hand",
    source: dbd?.registeredOn ? (dbd.manual ? "Entered by hand" : "DBD register") : null,
    result: !from ? "not_given" : regYear == null ? "by_hand" : match ? "match" : "differs",
    resultLabel: !from ? "Differs" : regYear == null ? "By hand" : match ? "Matches" : "Differs",
    link: null, checked,
  };
}

function directorRow(label: string, person: string | null, who: string, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const isDir = !!person && !!dbd?.directors.length && dbd.directors.some((d) => sameText(d, person));
  return {
    key: "director", label, from: person ? `${person}, ${who}` : null,
    found: dbd?.directors.length ? `Directors: ${dbd.directors.join(", ")}` : "Check by hand",
    source: dbd?.directors.length ? (dbd.manual ? "Entered by hand" : "DBD register") : null,
    result: !person ? "not_given" : !dbd?.directors.length ? "by_hand" : isDir ? "match" : "differs",
    resultLabel: !person ? "Differs" : !dbd?.directors.length ? "By hand" : isDir ? "Is a director" : "Not a director",
    link: null, checked,
  };
}

export function revenueRow(bandKey: string | null, bandYear: string, storySales: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const sellerBands: [string, string, number, number][] = [
    ["Below ฿50M", "Below ฿50M", 0, 50], ["฿50M – 100M", "฿50M – 100M", 50, 100],
    ["฿100M – 250M", "฿100M – 250M", 100, 250], ["฿250M – 500M", "฿250M – 500M", 250, 500],
    ["฿500M – 1B", "฿500M – 1B", 500, 1000], ["฿1B +", "฿1B +", 1000, Infinity],
  ];
  const band = [...REVENUE_BANDS, ...sellerBands].find((b) => b[0] === bandKey);
  const from = band ? `${band[1]} in ${bandYear}${storySales ? ` · the owner's story: ${storySales}` : ""}` : null;
  if (!band) {
    return { key: "revenue", label: "Revenue", from, found: "Check by hand", source: null, result: "not_given", resultLabel: "Not given", link: null, checked };
  }
  if (dbd?.revenueM == null) {
    return { key: "revenue", label: "Revenue", from, found: "Check by hand", source: null, result: "by_hand", resultLabel: "By hand", link: null, checked };
  }
  const inRange = dbd.revenueM >= band[2] && dbd.revenueM < band[3];
  return {
    key: "revenue", label: "Revenue", from,
    found: `${fmtM(dbd.revenueM)} in the ${dbd.revenueYear ?? bandYear} accounts ${dbd.manual ? "entered by hand" : "filed with DBD"}`, source: dbd.manual ? "Entered by hand" : "DBD financial statements",
    result: inRange ? "match" : "differs",
    resultLabel: inRange ? "In the range" : dbd.revenueM < band[2] ? "Below the range" : "Above the range",
    link: null, checked,
  };
}

export function websiteRow(url: string | null, status: "works" | "dead" | "none" | "unchecked"): ReviewRow {
  return {
    key: "website", label: "Website", from: url,
    found: status === "unchecked" ? "Check by hand" : status === "none" ? "Nothing to open" : status === "works" ? "The link opens" : "The link doesn't open",
    source: status === "none" || status === "unchecked" ? null : "Link check",
    result: status === "unchecked" ? "by_hand" : status === "none" ? "not_given" : status === "works" ? "match" : "differs",
    resultLabel: status === "unchecked" ? "By hand" : status === "none" ? "Not given" : status === "works" ? "Works" : "Doesn't open",
    link: url ? publicWebsite(url)?.href ?? null : null, checked: false,
  };
}

const notNeeded = (key: string, label: string): ReviewRow => ({
  key, label, from: "Not asked", found: "Not needed for an individual", source: null, result: "not_needed", resultLabel: "Not needed", link: null, checked: false,
});
const byHandId = (key: string, label: string, from: string | null, note: string, checked: boolean): ReviewRow => ({
  key, label, from, found: note, source: null, result: "by_hand", resultLabel: "By hand", link: null, checked,
});

/* ------------------------------------------------------------- sellers */

export async function sellerReview(sb: any, hp: any, st: any, founder: any, checked: string[]): Promise<OneStepReview> {
  const { facts: dbd, state: dbdState } = await dbdFromStore(sb, st?.registered_number);
  const web = await checkWebsite(st?.website_url);
  const has = (k: string) => checked.includes(k);
  const year = String(new Date().getFullYear() - 1);
  const storyYear = founder?.bio_story?.parts?.year ?? null;
  const storySales = founder?.bio_story?.parts?.sales ?? null;
  return {
    registrationNo: st?.registered_number ?? null,
    dbd: dbdState,
    individual: false,
    listingRows: [
      ["Reference", [hp.ref_no, st?.sector, st?.city].filter(Boolean).join(" · ")],
      ["Description", hp.description ?? "Not added"],
      ["Highlights", (hp.highlights ?? []).filter(Boolean).join(" · ") || "Not added"],
      ["Customer profile", hp.customers_summary ?? "Not added"],
      [`Revenue FY${String(year).slice(2)}`, st?.last_year_revenue ?? "Not added"],
      ["Asking price", priceLabel(hp) ?? "Not added"],
      ["Deal type", hp.deal_type ?? "Not added"],
      ["Owner handover", handoverLine(hp.owner_stays, hp.handover_months) ?? "Not added"],
      ["Sector", st?.sector ?? "Not added"],
    ],
    identityWords: Array.isArray(hp.__identityFlags) ? hp.__identityFlags : [],
    identityApplies: true,
    exclusiveRows: [
      { label: "Company name", value: st?.startup_name ?? "", note: "PitchSnack checks your registration." },
      { label: "Registration number", value: st?.registered_number ?? "", note: null },
      { label: "Address", value: st?.business_address ?? "", note: "PitchSnack checks your registered address." },
      { label: "Year founded", value: st?.year_founded ? String(st.year_founded) : "", note: null },
      { label: `Revenue in ${year}`, value: st?.last_year_revenue ?? "", note: "Checked against the accounts your company filed." },
      { label: "Owner", value: founder ? [founder.full_name, founder.position].filter(Boolean).join(" · ") : "", note: "Checked against your company's list of directors." },
      { label: "About the owner", value: founder?.bio ?? "", note: "PitchSnack checks the year founded and the sales against your company's records." },
      { label: "Website", value: st?.website_url ?? "", note: "PitchSnack checks that the link opens." },
      { label: "Email address", value: st?.email ?? "", note: "PitchSnack checks for corporate email." },
      { label: "Contact number", value: st?.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
    ],
    verification: [
      nameRow("Company name", st?.startup_name ?? null, dbd, has("name")),
      addressRow(st?.business_address ?? null, dbd, has("address")),
      yearRow(st?.year_founded ? String(st.year_founded) : null, storyYear, dbd, has("year")),
      directorRow("Owner vs directors", founder?.full_name ?? null, "the owner in About Owner", dbd, has("director")),
      revenueRow(st?.last_year_revenue ?? null, year, storySales, dbd, has("revenue")),
      { ...websiteRow(st?.website_url ?? null, web), checked: has("website") },
    ],
    email: st?.email ?? null,
    phone: st?.contact_number ?? null,
    personName: hp.__personName ?? null, personTitle: hp.__personTitle ?? null,
    directory: "Startups Directory",
    directoryId: hp.startup_id ?? null,
    card: {
      ref: hp.ref_no, type: st?.sector ?? null, place: st?.city ?? null,
      description: hp.description ?? null,
      figs: [
        [`Revenue FY${String(year).slice(2)}`, st?.last_year_revenue ?? "Not stated"],
        ["Asking price", priceLabel(hp) ?? "Not stated"],
        ["Deal type", hp.deal_type ?? "Not stated"],
        ["Owner handover", handoverLine(hp.owner_stays, hp.handover_months) ?? "Not stated"],
      ],
      realName: st?.startup_name ?? null, website: st?.website_url ?? null, address: st?.business_address ?? null,
      founded: st?.year_founded ? String(st.year_founded) : null,
      contact: founder ? [founder.full_name, founder.position].filter(Boolean).join(" · ") : null,
      sector: st?.sector ?? null, city: st?.city ?? null,
    },
  };
}

/* ------------------------------------------------------------- buyers */

export async function buyerReview(sb: any, p: any, inv: any, user: any, checked: string[]): Promise<OneStepReview> {
  const individual = p.buyer_relation === "individual";
  const { facts: dbd, state: dbdState } = individual ? { facts: null, state: (await dbdFromStore(sb, null)).state } : await dbdFromStore(sb, inv?.registration_no);
  const web = await checkWebsite(inv?.website_url);
  const has = (k: string) => checked.includes(k);
  const year = String(new Date().getFullYear() - 1);
  const { bandText } = await import("@/lib/investor-bands");
  const person = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || null;
  const address = [inv?.address_line1, inv?.address_line2, inv?.address_city_district, inv?.address_province_state, inv?.postal_code].filter(Boolean).join(", ") || p.address || null;
  const place = [p.city, inv?.country ?? p.country].filter(Boolean).join(" · ") || null;
  const focus = (inv?.investment_focus ?? []).join(", ") || null;
  const verification: ReviewRow[] = individual
    ? [
        byHandId("name", "Name", person, "No company record. Check it against their ID.", has("name")),
        byHandId("address", "Address", address, "Check it against their ID.", has("address")),
        notNeeded("year", "Year founded"), notNeeded("director", "Director vs user"), notNeeded("revenue", "Revenue"),
        { ...{ ...websiteRow(inv?.website_url ?? null, web), checked: has("website") }, ...(web === "none" ? { result: "not_needed" as const, resultLabel: "Not needed" } : {}) },
      ]
    : [
        nameRow("Company name", inv?.investor_name ?? null, dbd, has("name")),
        addressRow(address, dbd, has("address")),
        yearRow(inv?.year_founded ? String(inv.year_founded) : null, null, dbd, has("year")),
        directorRow("Director vs user", person, "who submitted the profile", dbd, has("director")),
        revenueRow(p.revenue_band ?? null, year, null, dbd, has("revenue")),
        { ...websiteRow(inv?.website_url ?? null, web), checked: has("website") },
      ];
  return {
    registrationNo: individual ? null : inv?.registration_no ?? null,
    dbd: dbdState,
    individual,
    listingRows: [
      ["Reference", [p.ref_no, inv?.investor_type, inv?.country ?? p.country].filter(Boolean).join(" · ")],
      ["Ticket size", bandText(inv?.ticket_band) ?? "Not set"],
      ["AUM", bandText(inv?.aum_band) ?? "Not set"],
      ["Min. target revenue", bandText(inv?.revenue_min_band) ?? "Not set"],
      ["Investment Focus", focus ?? "Not set"],
      ["Geography", p.geography ?? "Not set"],
      ["Industries", (inv?.preferred_industries ?? p.sectors ?? []).join(" · ") || "Not set"],
      ["Public description", p.description ?? "Not added"],
    ],
    identityWords: Array.isArray(p.__identityWords) ? p.__identityWords : [],
    identityApplies: true,
    exclusiveRows: individual
      ? [
          { label: "Your name", value: person ?? "", note: "PitchSnack checks your name and address against your ID." },
          { label: "Address", value: address ?? "", note: null },
          ...(inv?.website_url ? [{ label: "Website", value: inv.website_url, note: "PitchSnack checks that the link opens." }] : []),
          { label: "Email address", value: inv?.email ?? user?.email ?? "", note: "PitchSnack checks for corporate email." },
          { label: "Contact number", value: p.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
        ]
      : [
          { label: "Firm name", value: inv?.investor_name ?? "", note: "PitchSnack checks your registration." },
          { label: "Registration number", value: inv?.registration_no ?? "", note: null },
          { label: "Address", value: address ?? "", note: "PitchSnack checks your registered address." },
          { label: "Year founded", value: inv?.year_founded ? String(inv.year_founded) : "", note: null },
          { label: `Revenue in ${year}`, value: revenueBandLabel(p.revenue_band) ?? "", note: "Checked against the accounts your company filed." },
          { label: "Your name", value: [person, user?.title ?? null].filter(Boolean).join(" · "), note: "Checked against your company's list of directors." },
          { label: "Website", value: inv?.website_url ?? "", note: "PitchSnack checks that the link opens." },
          { label: "Email address", value: inv?.email ?? user?.email ?? "", note: "PitchSnack checks for corporate email." },
          { label: "Contact number", value: p.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
        ],
    verification,
    email: inv?.email ?? user?.email ?? null,
    phone: user?.phone ?? p.contact_number ?? null,
    personName: person, personTitle: user?.title ?? null,
    directory: "Investors Directory",
    directoryId: p.investor_id ?? null,
    card: {
      ref: p.ref_no, type: inv?.investor_type ?? null, place,
      description: p.description ?? null,
      figs: [
        ["Ticket size", bandText(inv?.ticket_band) ?? "Not stated"],
        ["AUM", bandText(inv?.aum_band) ?? "Not stated"],
        ["Min. target revenue", bandText(inv?.revenue_min_band) ?? "Not stated"],
        ["Investment Focus", focus ?? "Not stated"],
      ],
      realName: inv?.investor_name ?? null, website: inv?.website_url ?? null, address,
      founded: inv?.year_founded ? String(inv.year_founded) : null,
      contact: [person, user?.title].filter(Boolean).join(" · ") || null, sector: null, city: p.city ?? null,
    },
  };
}

/* ------------------------------------------------------------- advisors */

export async function advisorReview(sb: any, f: any, owner: any, checked: string[]): Promise<OneStepReview> {
  const { facts: dbd, state: dbdState } = await dbdFromStore(sb, f.registration_no);
  const web = await checkWebsite(f.website);
  const has = (k: string) => checked.includes(k);
  const person = [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") || owner?.email || null;
  const address = [f.addr_unit, f.addr_street, f.addr_subdistrict, f.addr_district, f.addr_province, f.addr_postal].filter(Boolean).join(", ") || null;
  const deal = f.deal_size_band ?? (f.deal_min_usd_m != null && f.deal_max_usd_m != null ? `US$${f.deal_min_usd_m}M – ${f.deal_max_usd_m}M` : null);
  return {
    registrationNo: f.registration_no ?? null,
    dbd: dbdState,
    individual: false,
    listingRows: [
      ["Reference", [f.ref_no, f.firm_type, f.city ?? f.country].filter(Boolean).join(" · ")],
      ["Firm type", f.firm_type ?? "Not set"],
      ["Team size", f.team_size ? String(f.team_size) : "Not set"],
      ["Typical deal size", deal ?? "Not set"],
      ["Services", (f.services ?? []).join(" · ") || "Not set"],
      ["Languages", (f.languages ?? []).join(" · ") || "Not set"],
      ["Description", f.description ?? "Not added"],
    ],
    identityWords: [],
    identityApplies: false,
    exclusiveRows: [
      { label: "Firm name", value: f.name ?? "", note: "PitchSnack checks your registration." },
      { label: "Registration no.", value: f.registration_no ?? "", note: null },
      { label: "Address", value: address ?? "", note: "PitchSnack checks your registered address." },
      { label: "Year founded", value: f.year_founded ? String(f.year_founded) : "", note: null },
      { label: "Your name", value: person ?? "", note: "Checked against your firm's list of directors." },
      { label: "Website", value: f.website ?? "", note: "PitchSnack checks that the link opens." },
      { label: "Email", value: f.email ?? "", note: "PitchSnack checks for corporate email." },
      { label: "Phone", value: f.phone ?? "", note: "Sellers and buyers see your website, email and phone on your profile." },
    ],
    verification: [
      nameRow("Company name", f.name ?? null, dbd, has("name")),
      addressRow(address, dbd, has("address")),
      yearRow(f.year_founded ? String(f.year_founded) : null, null, dbd, has("year")),
      directorRow("Director vs user", person, "who submitted the profile", dbd, has("director")),
      { ...websiteRow(f.website ?? null, web), checked: has("website") },
    ],
    email: f.email ?? null,
    phone: owner?.phone ?? f.phone ?? null,
    personName: person, personTitle: owner?.title ?? null,
    directory: "Advisors Directory",
    directoryId: f.id,
    card: {
      ref: f.ref_no, type: f.firm_type ?? null, place: [f.city, f.country].filter(Boolean).join(" · ") || null,
      description: f.description ?? null,
      figs: [
        ["Typical deal size", deal ?? "Not stated"],
        ["Team size", f.team_size ? String(f.team_size) : "Not stated"],
        ["Services", (f.services ?? []).slice(0, 2).join(" · ") || "Not stated"],
        ["Languages", (f.languages ?? []).join(" · ") || "Not stated"],
      ],
      realName: f.name ?? null, website: f.website ?? null, address,
      founded: f.year_founded ? String(f.year_founded) : null,
      contact: [person, owner?.title].filter(Boolean).join(" · ") || null, sector: null, city: f.city ?? null,
    },
  };
}
