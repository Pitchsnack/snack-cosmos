/**
 * DBD test scraper (server-only, TEST MODE ONLY).
 * ------------------------------------------------
 * Low-volume reader of publicly visible pages on https://datawarehouse.dbd.go.th
 * used ONLY to exercise the Financial Auto Enrich UX. It is never the production
 * integration: production keeps using the gateway in `dbd-provider.server.ts`.
 *
 * Boundaries enforced here:
 *  - enabled only when DBD_PROVIDER_MODE=test_scraper;
 *  - one lookup at a time (single-flight) and a short result cache;
 *  - triggered only by an explicit user Auto Enrich action — no crawling,
 *    enumeration, pagination harvesting or bulk search;
 *  - never bypasses CAPTCHA, login or anti-bot controls. When DBD asks for
 *    verification the lookup stops and a controlled error is returned;
 *  - never invents a value: unparsable/blank cells stay absent.
 *
 * Runtime note: the app server runs on a Worker runtime, so headless browser
 * automation (Playwright) cannot execute here. The scraper therefore performs
 * plain server-side HTTP reads of the same public pages; when DBD only renders
 * the data behind scripted navigation it reports `DBD_ACCESS_RESTRICTED` and the
 * UI keeps the existing financial data untouched.
 */
import type { DbdCompany, DbdLookupKey, DbdOutcome, DbdStatement } from "./dbd-provider.server";
import {
  detectDbdUnit,
  mapDbdLabel,
  normalizeRegisteredName,
  normalizeRegisteredNumber,
  parseDbdNumber,
  parseFiscalYear,
  toBaht,
  type DbdUnit,
} from "./dbd-parse";

const BASE = "https://datawarehouse.dbd.go.th";
const TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 10 * 60_000;

const cache = new Map<string, { at: number; outcome: DbdOutcome }>();
let inFlight: Promise<DbdOutcome> | null = null;

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.log("[dbd-test-scraper]", ...args);
}

async function getText(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "SnackPortal2-UXTest/1.0 (+contact: admin@pitchsnack.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "th,en;q=0.8",
      },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function looksRestricted(html: string): boolean {
  return /captcha|recaptcha|cf-challenge|Just a moment|กรุณายืนยันตัวตน|Access Denied/i.test(html);
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Extracts `<table>` blocks as row arrays of plain-text cells. */
export function extractTables(html: string): string[][][] {
  const tables: string[][][] = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows: string[][] = [];
    for (const r of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(stripTags);
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

/**
 * Turns DBD statement tables into per-year statements.
 * Row label drives the mapping; column position only selects the year.
 */
export function parseStatementTables(
  tables: string[][][],
  unit: DbdUnit | null,
): { statements: DbdStatement[]; warnings: string[]; unmapped: string[] } {
  const byYear = new Map<number, DbdStatement>();
  const warnings: string[] = [];
  const unmapped: string[] = [];

  for (const rows of tables) {
    const header = rows[0] ?? [];
    const years = header.map((c) => parseFiscalYear(c));
    if (!years.some((y) => y !== null)) continue;

    for (const row of rows.slice(1)) {
      const label = row[0];
      const mapped = mapDbdLabel(label);
      if (!mapped) {
        if (label && !unmapped.includes(label)) unmapped.push(label);
        continue;
      }
      for (let i = 1; i < row.length; i++) {
        const year = years[i];
        if (!year) continue;
        const value = parseDbdNumber(row[i]);
        if (value === null) continue;
        let stmt = byYear.get(year);
        if (!stmt) {
          stmt = {
            fiscalYear: year,
            currency: "THB",
            income: {},
            position: {},
            cashFlow: {},
            ratios: {},
          };
          byYear.set(year, stmt);
        }
        stmt[mapped.group][mapped.code] = toBaht(value, unit);
      }
    }
  }

  if (unmapped.length) warnings.push(`${unmapped.length} DBD row label(s) were not recognised.`);
  return {
    statements: [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear),
    warnings,
    unmapped,
  };
}

/** Company rows found on a DBD search result page. */
export function parseSearchResults(html: string): DbdCompany[] {
  const out: DbdCompany[] = [];
  const seen = new Set<string>();
  const linkRe = /<a[^>]+href="([^"]*profile[^"]*?(\d{13})[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const number = m[2];
    if (seen.has(number)) continue;
    seen.add(number);
    out.push({
      registeredNumber: number,
      registeredName: stripTags(m[3]) || null,
      sourceReference: m[1].startsWith("http") ? m[1] : `${BASE}${m[1]}`,
    });
    if (out.length >= 20) break;
  }
  return out;
}

async function lookup(input: {
  registeredNumber?: string | null;
  registeredName?: string | null;
}): Promise<DbdOutcome> {
  const number = normalizeRegisteredNumber(input.registeredNumber);
  const name = (input.registeredName ?? "").trim();
  if (!number && !name) return { status: "not_found" };

  let matchedBy: DbdLookupKey = "registered_number";
  let company: DbdCompany | null = null;

  // Step 1 — registered number (exact match only, never falls through on a hit).
  if (number) {
    const url = `${BASE}/searchJuristicInfo?jpNumber=${encodeURIComponent(number)}`;
    const res = await getText(url).catch((e) => ({ ok: false, status: 0, body: String(e) }));
    if (looksRestricted(res.body)) return { status: "unavailable", detail: "DBD_ACCESS_RESTRICTED" };
    if (res.ok) {
      const hit = parseSearchResults(res.body).find(
        (c) => normalizeRegisteredNumber(c.registeredNumber) === number,
      );
      if (hit) company = hit;
    }
    devLog("number lookup", { number, matched: Boolean(company), status: res.status });
  }

  // Step 2 — registered name fallback (ambiguity is never resolved automatically).
  if (!company && name) {
    matchedBy = "registered_name";
    const url = `${BASE}/searchJuristicInfo?jpNameTH=${encodeURIComponent(name)}`;
    const res = await getText(url).catch((e) => ({ ok: false, status: 0, body: String(e) }));
    if (looksRestricted(res.body)) return { status: "unavailable", detail: "DBD_ACCESS_RESTRICTED" };
    if (!res.ok) return { status: "unavailable", detail: `HTTP ${res.status}` };
    const candidates = parseSearchResults(res.body);
    const target = normalizeRegisteredName(name);
    const exact = candidates.filter((c) => normalizeRegisteredName(c.registeredName) === target);
    if (exact.length === 1) company = exact[0];
    else if (exact.length > 1) return { status: "ambiguous", candidates: exact };
    else if (candidates.length > 1) return { status: "ambiguous", candidates };
    else if (candidates.length === 1) company = candidates[0];
    devLog("name lookup", { name, candidates: candidates.length });
  }

  if (!company) return { status: "not_found" };

  // Financial profile page for the matched company only.
  const profileUrl = company.sourceReference ?? `${BASE}/company/profile/${company.registeredNumber}`;
  const profile = await getText(profileUrl).catch((e) => ({ ok: false, status: 0, body: String(e) }));
  if (looksRestricted(profile.body)) return { status: "unavailable", detail: "DBD_ACCESS_RESTRICTED" };
  if (!profile.ok) return { status: "unavailable", detail: `HTTP ${profile.status}` };

  const unit = detectDbdUnit(stripTags(profile.body).slice(0, 4000));
  const tables = extractTables(profile.body);
  if (tables.length === 0) return { status: "unavailable", detail: "DBD_LAYOUT_CHANGED" };

  const { statements, warnings, unmapped } = parseStatementTables(tables, unit);
  devLog("profile parsed", {
    url: profileUrl,
    unit,
    tables: tables.length,
    years: statements.map((s) => s.fiscalYear),
    unmapped,
  });

  if (statements.length === 0) return { status: "no_financials", company, matchedBy };
  return {
    status: "ok",
    company: { ...company, sourceReference: profileUrl },
    matchedBy,
    statements,
    warnings: ["Test scraper result — verify every value before saving.", ...warnings],
  };
}

/** Single-flight + short cache wrapper around the test scraper. */
export async function lookupDbdFinancialsViaTestScraper(input: {
  registeredNumber?: string | null;
  registeredName?: string | null;
}): Promise<DbdOutcome> {
  const key = `${normalizeRegisteredNumber(input.registeredNumber) ?? ""}|${normalizeRegisteredName(
    input.registeredName,
  )}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.outcome;
  if (inFlight) return { status: "unavailable", detail: "Another DBD lookup is already running." };

  inFlight = lookup(input).catch(
    (e): DbdOutcome => ({
      status: "unavailable",
      detail: e instanceof Error && e.name === "AbortError" ? "DBD_TIMEOUT" : "network error",
    }),
  );
  try {
    const outcome = await inFlight;
    cache.set(key, { at: Date.now(), outcome });
    return outcome;
  } finally {
    inFlight = null;
  }
}
