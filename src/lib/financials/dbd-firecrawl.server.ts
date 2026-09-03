/**
 * Production DBD Data Warehouse reader (server-only).
 * ---------------------------------------------------
 * https://datawarehouse.dbd.go.th is a Nuxt SPA behind Imperva bot protection,
 * so plain HTTP reads and headless browsers in the Worker runtime cannot reach
 * the statement tables. This adapter therefore drives the public pages through
 * the Firecrawl rendering service (`FIRECRAWL_API_KEY`).
 *
 * Guarantees:
 *  - only ever reads the single company page a user explicitly asked for;
 *  - never fabricates, estimates or zero-fills a value — blanks stay absent;
 *  - returns a typed outcome, never throws for expected failures.
 */
import type { DbdCompany, DbdLookupKey, DbdOutcome, DbdStatement } from "./dbd-provider.server";
import { normalizeRegisteredName, normalizeRegisteredNumber, parseDbdNumber } from "./dbd-parse";

const BASE = "https://datawarehouse.dbd.go.th";
const FIRECRAWL = "https://api.firecrawl.dev/v2/scrape";
const CACHE_TTL_MS = 30 * 60_000;

const cache = new Map<string, { at: number; outcome: DbdOutcome }>();

type Action = Record<string, unknown>;

/** DBD statement row label → SnackPortal2 item code (as rendered today). */
const INCOME_LABELS: Record<string, string> = {
  "รายได้หลัก": "revenue_sales_services",
  "รายได้จากการขายและบริการ": "revenue_sales_services",
  "รายได้รวม": "total_revenue",
  "ต้นทุนขาย": "cost_of_goods_sold",
  "กำไร(ขาดทุน) ขั้นต้น": "gross_profit_loss",
  "กำไร (ขาดทุน) ขั้นต้น": "gross_profit_loss",
  "กำไรขั้นต้น": "gross_profit_loss",
  "ค่าใช้จ่ายในการขายและบริหาร": "selling_admin_expenses",
  "รายจ่ายรวม": "total_expenses",
  "รวมค่าใช้จ่าย": "total_expenses",
  "ดอกเบี้ยจ่าย": "interest_expenses",
  "กำไร(ขาดทุน) ก่อนภาษี": "profit_loss_before_income_tax",
  "กำไร (ขาดทุน) ก่อนภาษี": "profit_loss_before_income_tax",
  "ภาษีเงินได้": "income_tax_expense",
  "กำไร(ขาดทุน) สุทธิ": "net_profit_loss",
  "กำไร (ขาดทุน) สุทธิ": "net_profit_loss",
  "กำไรสุทธิ": "net_profit_loss",
};

const POSITION_LABELS: Record<string, string> = {
  "ลูกหนี้การค้าสุทธิ": "accounts_receivable",
  "สินค้าคงเหลือ": "inventories",
  "สินทรัพย์หมุนเวียน": "total_current_assets",
  "รวมสินทรัพย์หมุนเวียน": "total_current_assets",
  "ที่ดิน อาคารและอุปกรณ์": "property_plant_equipment",
  "สินทรัพย์ไม่หมุนเวียน": "total_non_current_assets",
  "รวมสินทรัพย์ไม่หมุนเวียน": "total_non_current_assets",
  "สินทรัพย์รวม": "total_assets",
  "หนี้สินหมุนเวียน": "total_current_liabilities",
  "รวมหนี้สินหมุนเวียน": "total_current_liabilities",
  "หนี้สินไม่หมุนเวียน": "total_non_current_liabilities",
  "รวมหนี้สินไม่หมุนเวียน": "total_non_current_liabilities",
  "หนี้สินรวม": "total_liabilities",
  "ส่วนของผู้ถือหุ้น": "equity",
  "หนี้สินรวมและส่วนของผู้ถือหุ้น": "total_liabilities_equity",
  "รวมหนี้สินและส่วนของผู้ถือหุ้น": "total_liabilities_equity",
};

/** Ratio rows are numbered 1–15 on the DBD page, in a stable published order. */
const RATIO_BY_SEQ: Record<string, string> = {
  "1": "return_on_assets",
  "2": "return_on_equity",
  "3": "gross_profit_margin",
  "4": "operating_income_on_revenue",
  "5": "net_profit_margin",
  "6": "current_ratio",
  "7": "accounts_receivable_turnover",
  "8": "inventory_turnover",
  "9": "accounts_payable_turnover",
  "10": "total_assets_turnover",
  "11": "operation_expense_to_revenue",
  "12": "asset_to_equity",
  "13": "debt_to_asset_ratio",
  "14": "debt_to_equity_ratio",
  "15": "debt_to_capital_ratio",
};

const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function tables(html: string): string[][][] {
  const out: string[][][] = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows: string[][] = [];
    for (const r of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(clean);
      if (cells.length) rows.push(cells);
    }
    if (rows.length) out.push(rows);
  }
  return out;
}

/** Buddhist-era (พ.ศ.) years on the page become Gregorian years. */
function toYear(raw: string): number | null {
  const m = raw.match(/(\d{4})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y > 2400) y -= 543;
  return y >= 1900 && y <= 2999 ? y : null;
}

async function scrape(url: string, actions: Action[]): Promise<string | null> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return null;
  const res = await fetch(FIRECRAWL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      url,
      formats: ["rawHtml"],
      onlyMainContent: false,
      waitFor: 8000,
      timeout: 120000,
      actions,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: { rawHtml?: string }; rawHtml?: string }
    | null;
  return body?.data?.rawHtml ?? body?.rawHtml ?? null;
}

/** Opens the company page, then the requested financial section, and returns its HTML. */
function financialActions(section: 1 | 2 | 3): Action[] {
  return [
    { type: "wait", milliseconds: 6000 },
    { type: "click", selector: "#menu2" },
    { type: "wait", milliseconds: 1500 },
    { type: "click", selector: ".nav-tabs.main .dropdown-menu li:nth-child(2) a" },
    { type: "wait", milliseconds: 9000 },
    ...(section === 1
      ? []
      : [
          { type: "click", selector: `.finMenu:nth-of-type(${section})` },
          { type: "wait", milliseconds: 6000 },
        ]),
  ];
}

/** Amount tables print, per fiscal year, a pair of [amount, %change] columns. */
function parseAmountTable(
  rows: string[][],
  labels: Record<string, string>,
  into: Map<number, DbdStatement>,
  group: "income" | "position",
) {
  const header = rows[0] ?? [];
  const years = header.slice(1).map(toYear).filter((y): y is number => y !== null);
  if (!years.length) return;
  for (const row of rows.slice(1)) {
    const code = labels[row[0]?.trim() ?? ""];
    if (!code) continue;
    years.forEach((year, i) => {
      const value = parseDbdNumber(row[1 + i * 2]);
      if (value === null) return;
      const stmt = ensure(into, year);
      stmt[group][code] = value;
    });
  }
}

function parseRatioTable(rows: string[][], into: Map<number, DbdStatement>) {
  const header = rows[0] ?? [];
  const years = header.slice(2).map(toYear).filter((y): y is number => y !== null);
  if (!years.length) return;
  for (const row of rows.slice(1)) {
    const code = RATIO_BY_SEQ[row[0]?.trim() ?? ""];
    if (!code || row.length < 2 + years.length) continue;
    years.forEach((year, i) => {
      const value = parseDbdNumber(row[2 + i]);
      if (value === null) return;
      ensure(into, year).ratios[code] = value;
    });
  }
}

function ensure(map: Map<number, DbdStatement>, year: number): DbdStatement {
  let s = map.get(year);
  if (!s) {
    s = { fiscalYear: year, currency: "THB", income: {}, position: {}, cashFlow: {}, ratios: {} };
    map.set(year, s);
  }
  return s;
}

/** Reads the company header block (name + registration number) from the profile page. */
/**
 * Reads the "Company Profile" block. DBD renders it as label/value pairs in
 * either Thai or English; anything not found simply stays null.
 */
function parseProfile(html: string): DbdCompanyProfile {
  const text = clean(html);
  const LABELS: Record<keyof DbdCompanyProfile, string[]> = {
    registeredType: ["ประเภทนิติบุคคล", "Registered Type"],
    status: ["สถานะนิติบุคคล", "สถานะ", "Status"],
    registeredDate: ["วันที่จดทะเบียนจัดตั้ง", "วันที่จดทะเบียน", "Registered Date"],
    registeredCapital: ["ทุนจดทะเบียน", "Registered Capital"],
    businessSize: ["ขนาดธุรกิจ", "Business Size"],
  };
  // Every known label acts as a stop marker so a value never swallows the next row.
  const stops = [
    ...Object.values(LABELS).flat(),
    "Last Registered ID",
    "เลขทะเบียนนิติบุคคล",
    "ปีงบการเงิน",
    "Fiscal Year",
    "หมายเหตุ",
    "Remark",
    "Industry group",
    "กลุ่มธุรกิจ",
  ].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const read = (labels: string[]): string | null => {
    for (const label of labels) {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${esc}\\s*:?\\s*([^:]{1,80}?)\\s*(?=${stops.join("|")}|$)`);
      const m = text.match(re);
      const value = m?.[1]?.trim().replace(/^[-–—]$/, "");
      if (value) return value;
    }
    return null;
  };

  return {
    registeredType: read(LABELS.registeredType),
    status: read(LABELS.status),
    registeredDate: read(LABELS.registeredDate),
    registeredCapital: read(LABELS.registeredCapital),
    businessSize: read(LABELS.businessSize),
  };
}

/** Reads the company header block (name + registration number) from the profile page. */
function parseCompany(html: string): DbdCompany | null {
  const text = clean(html);
  const name = text.match(/ชื่อนิติบุคคล\s*:\s*([^#]{3,160}?)\s*เลขทะเบียนนิติบุคคล/);
  const number = text.match(/เลขทะเบียนนิติบุคคล\s*:?\s*(\d{13})/);
  if (!number) return null;
  const profile = parseProfile(html);
  return {
    registeredNumber: number[1],
    registeredName: name ? name[1].trim() : null,
    sourceReference: `${BASE}/company/profile/5${number[1]}`,
    ...(Object.values(profile).some(Boolean) ? { profile } : {}),
  };
}

/** Resolves a company name to its DBD profile using the site's own search box. */
async function findByName(name: string): Promise<{ number: string } | null> {
  const html = await scrape(`${BASE}/juristic`, [
    { type: "wait", milliseconds: 5000 },
    { type: "click", selector: "input[autocomplete=off]" },
    { type: "write", text: name },
    { type: "wait", milliseconds: 4000 },
    { type: "press", key: "Enter" },
    { type: "wait", milliseconds: 9000 },
  ]);
  if (!html) return null;
  const m = html.match(/company\/profile\/5(\d{13})/);
  return m ? { number: m[1] } : null;
}

async function lookup(input: {
  registeredNumber?: string | null;
  registeredName?: string | null;
}): Promise<DbdOutcome> {
  if (!process.env["FIRECRAWL_API_KEY"]) return { status: "not_configured" };

  const wanted = normalizeRegisteredNumber(input.registeredNumber);
  const name = (input.registeredName ?? "").trim();
  if (!wanted && !name) return { status: "not_found" };

  let matchedBy: DbdLookupKey = "registered_number";
  let number = wanted;

  // Registered number always wins; the name is only a fallback.
  if (!number) {
    if (!name) return { status: "not_found" };
    matchedBy = "registered_name";
    const found = await findByName(name);
    if (!found) return { status: "not_found" };
    number = found.number;
  }

  const profileUrl = `${BASE}/company/profile/5${number}`;
  const positionHtml = await scrape(profileUrl, financialActions(1));
  if (!positionHtml) return { status: "unavailable", detail: "DBD_UNREACHABLE" };
  if (/404 - Page not found|Oops!/.test(clean(positionHtml).slice(0, 500))) {
    return { status: "not_found" };
  }

  const company = parseCompany(positionHtml);
  if (!company) return { status: "not_found" };
  if (
    matchedBy === "registered_name" &&
    name &&
    company.registeredName &&
    normalizeRegisteredName(company.registeredName) !== normalizeRegisteredName(name) &&
    !normalizeRegisteredName(company.registeredName).includes(normalizeRegisteredName(name))
  ) {
    // The site's own search returned a different company — never guess.
    return { status: "ambiguous", candidates: [company] };
  }

  const [incomeHtml, ratioHtml] = await Promise.all([
    scrape(profileUrl, financialActions(2)),
    scrape(profileUrl, financialActions(3)),
  ]);

  const byYear = new Map<number, DbdStatement>();
  const warnings: string[] = [];

  const posTable = tables(positionHtml).find((t) => (t[0]?.[0] ?? "").includes("หน่วย"));
  if (posTable) parseAmountTable(posTable, POSITION_LABELS, byYear, "position");
  else warnings.push("Financial position table was not found on the DBD page.");

  const incTable = incomeHtml
    ? tables(incomeHtml).find((t) => (t[0]?.[0] ?? "").includes("หน่วย"))
    : undefined;
  if (incTable) parseAmountTable(incTable, INCOME_LABELS, byYear, "income");
  else warnings.push("Income statement table was not found on the DBD page.");

  const ratTable = ratioHtml
    ? tables(ratioHtml).find((t) => (t[0]?.[1] ?? "").includes("อัตราส่วน"))
    : undefined;
  if (ratTable) parseRatioTable(ratTable, byYear);
  else warnings.push("Financial ratio table was not found on the DBD page.");

  const statements = [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
  if (statements.length === 0) return { status: "no_financials", company, matchedBy };

  return { status: "ok", company, matchedBy, statements, warnings };
}

/** Cached wrapper — one company lookup per explicit user action. */
export async function lookupDbdFinancialsViaFirecrawl(input: {
  registeredNumber?: string | null;
  registeredName?: string | null;
}): Promise<DbdOutcome> {
  const key = `${normalizeRegisteredNumber(input.registeredNumber) ?? ""}|${normalizeRegisteredName(
    input.registeredName,
  )}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.outcome;

  const outcome = await lookup(input).catch(
    (e): DbdOutcome => ({
      status: "unavailable",
      detail: e instanceof Error ? e.message : "network error",
    }),
  );
  cache.set(key, { at: Date.now(), outcome });
  return outcome;
}
