/**
 * Listed companies master table — client-safe types and CSV helpers.
 *
 * Peer sets reference rows in this table; they never copy the figures.
 */

import type { PeerMarket } from "@/lib/peer-comparables";

export interface ListedCompany {
  id: string;
  ticker: string;
  name: string;
  market: PeerMarket;
  sector: string | null;
  revenueThbM: number | null;
  ebitdaMarginPct: number | null;
  evEbitda: number | null;
  pe: number | null;
  pbv: number | null;
  /** Fiscal statement end, as entered — "Dec-25" or "Dec-2025". */
  statementPeriod: string | null;
  /** Short business descriptor — "Telecom". */
  tag: string | null;
  asAt: string | null;
  /** Number of peer sets referencing this company. Unused (0) is fine. */
  usedIn: number;
  /** Labels of the peer sets referencing it — used by the delete warning. */
  usedInSets: string[];
}

export interface ListedCompanyInput {
  id?: string | null;
  ticker: string;
  name: string;
  market: PeerMarket;
  sector: string | null;
  revenueThbM: number | null;
  ebitdaMarginPct: number | null;
  evEbitda: number | null;
  pe: number | null;
  pbv: number | null;
  statementPeriod: string | null;
  tag: string | null;
  asAt: string | null;
}

export type MarketTab = "all" | "SET" | "mai";

export const MARKET_TABS: { value: MarketTab; label: string }[] = [
  { value: "all", label: "All markets" },
  { value: "SET", label: "SET" },
  { value: "mai", label: "mai" },
];

export function emptyListedCompany(market: PeerMarket): ListedCompanyInput {
  return {
    ticker: "",
    name: "",
    market,
    sector: null,
    revenueThbM: null,
    ebitdaMarginPct: null,
    evEbitda: null,
    pe: null,
    pbv: null,
    statementPeriod: null,
    tag: null,
    asAt: null,
  };
}


/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export const LISTED_CSV_HEADER =
  "company,ticker,market,sector,revenue_thb_m,ebitda_margin_pct,ev_ebitda,pe,pbv,statement_period,tag,as_at";

export function listedCompaniesToCsv(rows: ListedCompany[]): string {
  return [
    LISTED_CSV_HEADER,
    ...rows.map((r) =>
      csvRow([
        r.name,
        r.ticker,
        r.market,
        r.sector,
        r.revenueThbM,
        r.ebitdaMarginPct,
        r.evEbitda,
        r.pe,
        r.pbv,
        r.statementPeriod,
        r.tag,
        r.asAt,
      ]),
    ),
  ].join("\n");
}


export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function listedCsvFilename(tab: MarketTab): string {
  const scope = tab === "all" ? "all-markets" : tab.toLowerCase();
  return `listed-companies_${scope}_${todayIso()}.csv`;
}

/** Downloads a CSV in the browser. */
export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Splits a CSV line honouring quoted cells. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function csvNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[,%×x\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parses a listed-companies CSV. Header row required; unknown columns ignored. */
export function parseListedCsv(text: string): {
  rows: ListedCompanyInput[];
  errors: string[];
} {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["The file has no data rows."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const cName = idx("company", "companyname", "name");
  const cTicker = idx("ticker");
  const cMarket = idx("market");
  const cSector = idx("sector");
  const cRev = idx("revenuethbm", "revenue");
  const cMargin = idx("ebitdamarginpct", "ebitdamargin");
  const cEv = idx("evebitda");
  const cPe = idx("pe");
  const cPbv = idx("pbv");
  const cPeriod = idx("statementperiod", "period");
  const cTag = idx("tag");
  const cAsAt = idx("asat");

  if (cTicker < 0 && cName < 0)
    return { rows: [], errors: ["No 'Company' or 'Ticker' column found in the file."] };

  // Unknown columns are ignored, but named so the user knows they were skipped.
  const known = new Set([
    cName,
    cTicker,
    cMarket,
    cSector,
    cRev,
    cMargin,
    cEv,
    cPe,
    cPbv,
    cPeriod,
    cTag,
    cAsAt,
  ]);
  const rawHeader = splitCsvLine(lines[0]);
  const unknown = rawHeader.filter((h, i) => h.trim() !== "" && !known.has(i));
  if (unknown.length)
    errors.push(`Ignored unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);

  const rows: ListedCompanyInput[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitCsvLine(line);
    const name = (cName >= 0 ? cells[cName] : "")?.trim() ?? "";
    const ticker = (cTicker >= 0 ? cells[cTicker] : "")?.trim() ?? "";
    if (!name && !ticker) {
      errors.push(`Row ${i + 2}: no company name or ticker — skipped.`);
      return;
    }
    const rawMarket = (cMarket >= 0 ? cells[cMarket] : "")?.trim().toLowerCase();
    rows.push({
      ticker: ticker || name,
      name: name || ticker,
      market: rawMarket === "mai" ? "mai" : "SET",
      sector: (cSector >= 0 ? cells[cSector]?.trim() : "") || null,
      revenueThbM: csvNumber(cRev >= 0 ? cells[cRev] : undefined),
      ebitdaMarginPct: csvNumber(cMargin >= 0 ? cells[cMargin] : undefined),
      evEbitda: csvNumber(cEv >= 0 ? cells[cEv] : undefined),
      pe: csvNumber(cPe >= 0 ? cells[cPe] : undefined),
      pbv: csvNumber(cPbv >= 0 ? cells[cPbv] : undefined),
      statementPeriod: (cPeriod >= 0 ? cells[cPeriod]?.trim() : "") || null,
      tag: (cTag >= 0 ? cells[cTag]?.trim() : "") || null,
      asAt: csvDate(cAsAt >= 0 ? cells[cAsAt] : undefined),
    });
  });


  return { rows, errors };
}
