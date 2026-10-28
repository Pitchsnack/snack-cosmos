/**
 * One-step approval (server-only): queue + review assembly for Admin ›
 * Approvals, shared by sellers, buyers and advisors. DBD comparison data comes
 * from the imported company_info_th / company_director_th tables (sellers) or a
 * live DBD lookup by registration number (buyers, advisors). Revenue filed with
 * DBD is not part of the imported data, so the Revenue row is "by hand" unless
 * a filed amount is available.
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
  individual: boolean;
  listingRows: [string, string][]; // Listing view rows (label, value)
  identityWords: string[]; // identity check findings ([] = clean; null row for advisors)
  identityApplies: boolean;
  exclusiveRows: { label: string; value: string; note: string | null }[];
  verification: ReviewRow[];
  email: string | null;
  phone: string | null;
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

export const REVENUE_BANDS: [string, string, number, number][] = [
  ["rv_lt100", "Below ฿100M", 0, 100],
  ["rv_100_300", "฿100M – 300M", 100, 300],
  ["rv_300_800", "฿300M – 800M", 300, 800],
  ["rv_800_1500", "฿800M – 1.5B", 800, 1500],
  ["rv_1500", "฿1.5B and above", 1500, Number.MAX_SAFE_INTEGER],
];
export const revenueBandLabel = (key: string | null | undefined) =>
  REVENUE_BANDS.find((b) => b[0] === key)?.[1] ?? null;

/** Case/punctuation/space-insensitive compare, Thai-aware. */
export const normText = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9฀-๿]+/g, " ").trim();

const sameText = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normText(a), nb = normText(b);
  return !!na && !!nb && na === nb;
};

export const waitingDays = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0;

/** Server-side website check: the link opens when it answers under 400. */
export async function checkWebsite(url: string | null | undefined): Promise<"works" | "dead" | "none"> {
  if (!url?.trim()) return "none";
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(href, { method: "GET", redirect: "follow", signal: ctrl.signal });
    return res.status < 400 ? "works" : "dead";
  } catch {
    return "dead";
  } finally {
    clearTimeout(timer);
  }
}

type DbdFacts = {
  nameTh: string | null; nameEn: string | null; address: string | null;
  registeredOn: string | null; directors: string[]; revenueM: number | null; revenueYear: number | null;
};

/** Seller DBD facts from the imported company_info_th + directors (My Financials import). */
async function dbdForStartup(sb: any, startupId: string | null): Promise<DbdFacts | null> {
  if (!startupId) return null;
  const { data: ci } = await sb.from("company_info_th").select("*").eq("startup_id", startupId).maybeSingle();
  if (!ci) return null;
  const { data: dirs } = await sb.from("company_director_th").select("director_name_th").eq("startup_id", startupId).eq("is_active", true).order("display_order");
  // Latest filed revenue, when the accounts were imported with the company data.
  const { data: fin } = await sb.from("financial_statements").select("id, fiscal_year").eq("startup_id", startupId).order("fiscal_year", { ascending: false }).limit(1);
  let revenueM: number | null = null, revenueYear: number | null = fin?.[0]?.fiscal_year ?? null;
  if (fin?.[0]) {
    const { data: items } = await sb.from("income_statement_items").select("name, amount").eq("statement_id", fin[0].id);
    const rev = (items ?? []).find((i: any) => /revenue|sales|รายได้/i.test(String(i.name ?? "")));
    if (rev?.amount != null && Number.isFinite(Number(rev.amount))) revenueM = Number(rev.amount) / 1_000_000;
  }
  return {
    nameTh: ci.legal_name_th ?? null, nameEn: ci.legal_name_en ?? null,
    address: ci.head_office_address_th ?? null, registeredOn: ci.registration_date ?? null,
    directors: (dirs ?? []).map((d: any) => d.director_name_th).filter(Boolean),
    revenueM, revenueYear,
  };
}

/** Buyer/advisor DBD facts from a live lookup by 13-digit registration number. */
async function dbdForRegistration(regNo: string | null | undefined): Promise<DbdFacts | null> {
  if (!/^\d{13}$/.test(regNo ?? "")) return null;
  try {
    const { lookupDbdFinancials } = await import("@/lib/financials/dbd-provider.server");
    const r: any = await lookupDbdFinancials({ registeredNumber: regNo });
    const c = r?.company;
    if (!c) return null;
    const ci = c.companyInfo ?? {};
    // Filed revenue: latest statement's revenue-like income line, when DBD published it.
    let revenueM: number | null = null, revenueYear: number | null = null;
    const stmts = Array.isArray(r.statements) ? r.statements : [];
    const latest = stmts.slice().sort((a: any, b: any) => (b.fiscalYear ?? 0) - (a.fiscalYear ?? 0))[0];
    if (latest) {
      revenueYear = latest.fiscalYear ?? null;
      const entry = Object.entries(latest.income ?? {}).find(([k]) => /revenue|sales/i.test(k));
      if (entry && Number.isFinite(Number(entry[1]))) revenueM = Number(entry[1]) / 1_000_000;
    }
    return {
      nameTh: ci.legalNameTh ?? null, nameEn: ci.legalNameEn ?? c.registeredName ?? null,
      address: ci.headOfficeAddressTh ?? null, registeredOn: ci.registrationDate ?? c.profile?.registeredDate ?? null,
      directors: Array.isArray(ci.directors) ? ci.directors.filter(Boolean) : [],
      revenueM, revenueYear,
    };
  } catch {
    return null;
  }
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

function nameRow(label: string, from: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const found = dbd ? [dbd.nameEn, dbd.nameTh].filter(Boolean).join(" / ") || null : null;
  const match = dbd && (sameText(from, dbd.nameEn) || sameText(from, dbd.nameTh));
  return {
    key: "name", label, from, found: found ?? "Check by hand", source: dbd ? "DBD register" : null,
    result: !from ? "not_given" : !dbd ? "by_hand" : match ? "match" : "differs",
    resultLabel: !from ? "Not given" : !dbd ? "By hand" : match ? "Matches" : "Differs",
    link: null, checked,
  };
}

function addressRow(from: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  return {
    key: "address", label: "Address", from, found: dbd?.address ?? "Check by hand", source: dbd?.address ? "DBD register" : null,
    result: !from ? "not_given" : !dbd?.address ? "by_hand" : sameText(from, dbd.address) ? "match" : "differs",
    resultLabel: !from ? "Not given" : !dbd?.address ? "By hand" : sameText(from, dbd.address) ? "Matches" : "Differs",
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
    source: dbd?.registeredOn ? "DBD register" : null,
    result: !from ? "not_given" : regYear == null ? "by_hand" : match ? "match" : "differs",
    resultLabel: !from ? "Not given" : regYear == null ? "By hand" : match ? "Matches" : "Differs",
    link: null, checked,
  };
}

function directorRow(label: string, person: string | null, who: string, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const isDir = !!person && !!dbd?.directors.length && dbd.directors.some((d) => sameText(d, person));
  return {
    key: "director", label, from: person ? `${person}, ${who}` : null,
    found: dbd?.directors.length ? `Directors: ${dbd.directors.join(", ")}` : "Check by hand",
    source: dbd?.directors.length ? "DBD register" : null,
    result: !person ? "not_given" : !dbd?.directors.length ? "by_hand" : isDir ? "match" : "differs",
    resultLabel: !person ? "Not given" : !dbd?.directors.length ? "By hand" : isDir ? "Is a director" : "Not a director",
    link: null, checked,
  };
}

function revenueRow(bandKey: string | null, bandYear: string, storySales: string | null, dbd: DbdFacts | null, checked: boolean): ReviewRow {
  const band = REVENUE_BANDS.find((b) => b[0] === bandKey);
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
    found: `${fmtM(dbd.revenueM)} in the ${dbd.revenueYear ?? bandYear} accounts filed with DBD`, source: "DBD financial statements",
    result: inRange ? "match" : "differs",
    resultLabel: inRange ? "In the range" : dbd.revenueM < band[2] ? "Below the range" : "Above the range",
    link: null, checked,
  };
}

function websiteRow(url: string | null, status: "works" | "dead" | "none"): ReviewRow {
  return {
    key: "website", label: "Website", from: url,
    found: status === "none" ? "Nothing to open" : "The link opens",
    source: status === "none" ? null : "Link check",
    result: status === "none" ? "not_given" : status === "works" ? "match" : "differs",
    resultLabel: status === "none" ? "Not given" : status === "works" ? "Works" : "Doesn't open",
    link: status === "none" ? null : url, checked: false,
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
  const dbd = await dbdForStartup(sb, hp.startup_id);
  const web = await checkWebsite(st?.website_url);
  const has = (k: string) => checked.includes(k);
  const year = String(new Date().getFullYear() - 1);
  const storyYear = founder?.bio_story?.year ?? null;
  const storySales = founder?.bio_story?.sales ?? null;
  return {
    registrationNo: st?.registered_number ?? null,
    individual: false,
    listingRows: [
      ["Reference", [hp.ref_no, hp.sector ?? st?.sector, st?.city].filter(Boolean).join(" · ")],
      ["Description", hp.description ?? "Not added"],
      ["Highlights", (hp.highlights ?? []).filter(Boolean).join(" · ") || "Not added"],
      ["Customer profile", hp.customers_summary ?? "Not added"],
      [`Revenue FY${String(year).slice(2)}`, st?.last_year_revenue ?? "Not added"],
      ["Asking price", hp.asking_price_band ?? (hp.asking_price_thb ? fmtM(Number(hp.asking_price_thb) / 1_000_000) : "Not added")],
      ["Deal type", hp.deal_type ?? "Not added"],
      ["Owner handover", hp.owner_stays === "stays" ? (hp.handover_months ? `${hp.handover_months} months` : "Stays") : hp.owner_stays === "leaves" ? "Owner leaves at completion" : "Not added"],
      ["Sector", hp.sector ?? st?.sector ?? "Not added"],
    ],
    identityWords: Array.isArray(hp.__identityFlags) ? hp.__identityFlags : [],
    identityApplies: true,
    exclusiveRows: [
      { label: "Company name", value: st?.startup_name ?? "", note: "PitchSnack checks your registration." },
      { label: "Registration number", value: st?.registered_number ?? "", note: null },
      { label: "Address", value: st?.business_address ?? "", note: "PitchSnack checks your registered address." },
      { label: "Year founded", value: st?.year_founded ? String(st.year_founded) : "", note: null },
      { label: `Revenue in ${year}`, value: st?.last_year_revenue ?? "", note: "Checked against the accounts your company filed." },
      { label: "Owner", value: founder ? [founder.full_name, founder.role_title].filter(Boolean).join(" · ") : "", note: "Checked against your company's list of directors." },
      { label: "About the owner", value: founder?.bio ?? "", note: "PitchSnack checks the year founded and the sales against your company's records." },
      { label: "Website", value: st?.website_url ?? "", note: "PitchSnack checks that the link opens." },
      { label: "Email address", value: st?.email ?? "", note: "PitchSnack checks for corporate email." },
      { label: "Contact number", value: st?.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
    ],
    verification: [
      nameRow("Company name", st?.registered_name ?? st?.startup_name ?? null, dbd, has("name")),
      addressRow(st?.business_address ?? null, dbd, has("address")),
      yearRow(st?.year_founded ? String(st.year_founded) : null, storyYear, dbd, has("year")),
      directorRow("Owner vs directors", founder?.full_name ?? null, "the owner in About Owner", dbd, has("director")),
      revenueRow(null, year, storySales, dbd, has("revenue")),
      websiteRow(st?.website_url ?? null, web),
    ],
    email: st?.email ?? null,
    phone: st?.contact_number ?? null,
    directory: "Startups Directory",
    directoryId: hp.startup_id ?? null,
    card: {
      ref: hp.ref_no, type: hp.sector ?? st?.sector ?? null, place: st?.city ?? null,
      description: hp.description ?? null,
      figs: [
        [`Revenue FY${String(year).slice(2)}`, st?.last_year_revenue ?? "Not stated"],
        ["Asking price", hp.asking_price_band ?? "Not stated"],
        ["Deal type", hp.deal_type ?? "Not stated"],
        ["Owner handover", hp.owner_stays === "stays" ? (hp.handover_months ? `${hp.handover_months} months` : "Stays") : hp.owner_stays === "leaves" ? "Owner leaves at completion" : "Not stated"],
      ],
      realName: st?.startup_name ?? null, website: st?.website_url ?? null, address: st?.business_address ?? null,
      founded: st?.year_founded ? String(st.year_founded) : null,
      contact: founder ? [founder.full_name, founder.role_title].filter(Boolean).join(" · ") : null,
      sector: hp.sector ?? st?.sector ?? null, city: st?.city ?? null,
    },
  };
}

/* ------------------------------------------------------------- buyers */

export async function buyerReview(sb: any, p: any, inv: any, user: any, checked: string[]): Promise<OneStepReview> {
  const individual = p.buyer_relation === "individual";
  const dbd = individual ? null : await dbdForRegistration(inv?.registration_no);
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
        websiteRow(inv?.website_url ?? null, web),
      ]
    : [
        nameRow("Company name", inv?.investor_name ?? null, dbd, has("name")),
        addressRow(address, dbd, has("address")),
        yearRow(inv?.year_founded ? String(inv.year_founded) : null, null, dbd, has("year")),
        directorRow("Director vs user", person, "who submitted the profile", dbd, has("director")),
        revenueRow(p.revenue_band ?? null, year, null, dbd, has("revenue")),
        websiteRow(inv?.website_url ?? null, web),
      ];
  return {
    registrationNo: individual ? null : inv?.registration_no ?? null,
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
          { label: "Website", value: inv?.website_url ?? "", note: "PitchSnack checks that the link opens." },
          { label: "Email address", value: inv?.email ?? user?.email ?? "", note: "PitchSnack checks for corporate email." },
          { label: "Contact number", value: p.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
        ]
      : [
          { label: "Firm name", value: inv?.investor_name ?? "", note: "PitchSnack checks your registration." },
          { label: "Registration number", value: inv?.registration_no ?? "", note: null },
          { label: "Address", value: address ?? "", note: "PitchSnack checks your registered address." },
          { label: "Year founded", value: inv?.year_founded ? String(inv.year_founded) : "", note: null },
          { label: `Revenue in ${year}`, value: revenueBandLabel(p.revenue_band) ?? "", note: "Checked against the accounts your company filed." },
          { label: "Your name", value: [person, (Array.isArray(p.people) && p.people[0]?.role) || null].filter(Boolean).join(" · "), note: "Checked against your company's list of directors." },
          { label: "Website", value: inv?.website_url ?? "", note: "PitchSnack checks that the link opens." },
          { label: "Email address", value: inv?.email ?? user?.email ?? "", note: "PitchSnack checks for corporate email." },
          { label: "Contact number", value: p.contact_number ?? "", note: "Your email and phone number are kept private and are never shared with other users." },
        ],
    verification,
    email: inv?.email ?? user?.email ?? null,
    phone: p.contact_number ?? null,
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
      contact: person, sector: null, city: p.city ?? null,
    },
  };
}

/* ------------------------------------------------------------- advisors */

export async function advisorReview(sb: any, f: any, owner: any, checked: string[]): Promise<OneStepReview> {
  const dbd = f.dbd_checked_at
    ? { nameTh: null, nameEn: f.dbd_name ?? null, address: null, registeredOn: f.dbd_registered_on ?? null, directors: [] as string[], revenueM: null, revenueYear: null }
    : await dbdForRegistration(f.registration_no);
  const web = await checkWebsite(f.website);
  const has = (k: string) => checked.includes(k);
  const person = [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") || owner?.email || null;
  const address = [f.addr_unit, f.addr_street, f.addr_subdistrict, f.addr_district, f.addr_province, f.addr_postal].filter(Boolean).join(", ") || null;
  const deal = f.deal_size_band ?? (f.deal_min_usd_m != null && f.deal_max_usd_m != null ? `US$${f.deal_min_usd_m}M – ${f.deal_max_usd_m}M` : null);
  return {
    registrationNo: f.registration_no ?? null,
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
      { label: "Firm name", value: f.legal_name ?? f.name ?? "", note: "PitchSnack checks your registration." },
      { label: "Registration no.", value: f.registration_no ?? "", note: null },
      { label: "Address", value: address ?? "", note: "PitchSnack checks your registered address." },
      { label: "Year founded", value: f.year_founded ? String(f.year_founded) : "", note: null },
      { label: "Your name", value: person ?? "", note: "Checked against your firm's list of directors." },
      { label: "Website", value: f.website ?? "", note: "PitchSnack checks that the link opens." },
      { label: "Email", value: f.email ?? "", note: "PitchSnack checks for corporate email." },
      { label: "Phone", value: f.phone ?? "", note: "Sellers and buyers see your website, email and phone on your profile." },
    ],
    verification: [
      nameRow("Company name", f.legal_name ?? f.name ?? null, dbd, has("name")),
      addressRow(address, dbd, has("address")),
      yearRow(f.year_founded ? String(f.year_founded) : null, null, dbd, has("year")),
      directorRow("Director vs user", person, "who submitted the profile", dbd, has("director")),
      websiteRow(f.website ?? null, web),
    ],
    email: f.email ?? null,
    phone: f.phone ?? null,
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
      contact: person, sector: null, city: f.city ?? null,
    },
  };
}
