/**
 * Shared, client-safe types and helpers for Peer Comparables.
 * Peer sets are reference data keyed on Sector + Business model.
 * Industry plays no part in peer matching.
 */

import { businessModelLabel } from "@/lib/sectors";

export const PEER_MARKETS = ["SET", "mai"] as const;
export type PeerMarket = (typeof PEER_MARKETS)[number];

/** A peer set is either sector-wide (null model) or model-specific. */
export function peerSetLabel(sector: string, businessModel: string | null): string {
  return `${sector} · ${businessModel ? (businessModelLabel(businessModel) ?? businessModel) : "All business models"}`;
}

export interface Peer {
  id?: string;
  /** Row in listed_companies this peer points at. Figures are read from there. */
  listedCompanyId?: string;
  companyName: string;
  ticker: string | null;
  market: PeerMarket;
  revenueThbM: number | null;
  ebitdaMarginPct: number | null;
  evEbitda: number | null;
  pe: number | null;
  pbv: number | null;
}

export interface PeerSetDetail {
  exists: boolean;
  id: string | null;
  sector: string;
  businessModel: string | null;
  lastRefreshedAt: string | null;
  ownerName: string | null;
  peers: Peer[];
}

export interface PeerSetSummary {
  sector: string;
  businessModel: string | null;
  exists: boolean;
  peerCount: number;
  setCount: number;
  maiCount: number;
  lastRefreshedAt: string | null;
  ownerName: string | null;
}

/** What the valuation view needs to pick a state. */
export interface PeerMatchResult {
  /** "no-sector" | "no-peer-set" | "sector-only" | "exact" */
  state: "no-sector" | "no-peer-set" | "sector-only" | "exact";
  sector: string | null;
  businessModel: string | null;
  applied: {
    sector: string;
    businessModel: string | null;
    peerCount: number;
    lastRefreshedAt: string | null;
  } | null;
  /** Only in "sector-only": a narrower set exists that the user could unlock. */
  narrower: { businessModel: string; label: string; peerCount: number } | null;
}

export type PeerSetStatus = "not built" | "current" | "stale";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function peerSetStatus(row: {
  exists: boolean;
  lastRefreshedAt: string | null;
}): PeerSetStatus {
  if (!row.exists) return "not built";
  if (!row.lastRefreshedAt) return "stale";
  const age = Date.now() - new Date(row.lastRefreshedAt).getTime();
  return age > NINETY_DAYS_MS ? "stale" : "current";
}

/** Median of the non-null values; null when the column is entirely empty. */
export function median(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const EMPTY_CELL = "—";

export function fmtMetric(v: number | null, suffix = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EMPTY_CELL;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export function emptyPeer(): Peer {
  return {
    companyName: "",
    ticker: null,
    market: "SET",
    revenueThbM: null,
    ebitdaMarginPct: null,
    evEbitda: null,
    pe: null,
    pbv: null,
  };
}

/** Parses a CSV of peers. Header row required; unknown columns ignored. */
export function parsePeerCsv(text: string): { peers: Peer[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { peers: [], errors: ["The file has no data rows."] };

  const split = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

  const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const cName = idx("company", "companyname");
  const cTicker = idx("ticker");
  const cMarket = idx("market");
  const cRev = idx("revenuethbm", "revenue");
  const cMargin = idx("ebitdamarginpct", "ebitdamargin");
  const cEv = idx("evebitda");
  const cPe = idx("pe");
  const cPbv = idx("pbv");

  if (cName < 0) return { peers: [], errors: ["No 'Company' column found in the file."] };

  const num = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const cleaned = raw.replace(/[,%×x\s]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === EMPTY_CELL) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const peers: Peer[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = split(line);
    const name = cells[cName]?.trim();
    if (!name) {
      errors.push(`Row ${i + 2}: missing company name — skipped.`);
      return;
    }
    const rawMarket = (cMarket >= 0 ? cells[cMarket] : "")?.trim().toLowerCase();
    const market: PeerMarket = rawMarket === "mai" ? "mai" : "SET";
    peers.push({
      companyName: name,
      ticker: cTicker >= 0 ? cells[cTicker]?.trim() || null : null,
      market,
      revenueThbM: num(cRev >= 0 ? cells[cRev] : undefined),
      ebitdaMarginPct: num(cMargin >= 0 ? cells[cMargin] : undefined),
      evEbitda: num(cEv >= 0 ? cells[cEv] : undefined),
      pe: num(cPe >= 0 ? cells[cPe] : undefined),
      pbv: num(cPbv >= 0 ? cells[cPbv] : undefined),
    });
  });

  return { peers, errors };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

/** Header matches what `parsePeerCsv` accepts, so exports re-import cleanly. */
export const PEER_CSV_HEADER =
  "company,ticker,market,revenue_thb_m,ebitda_margin_pct,ev_ebitda,pe,pbv";

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Peers only — the median row is never exported. Empty metrics stay empty. */
export function peersToCsv(peers: Peer[]): string {
  return [
    PEER_CSV_HEADER,
    ...peers.map((p) =>
      [
        p.companyName,
        p.ticker,
        p.market,
        p.revenueThbM,
        p.ebitdaMarginPct,
        p.evEbitda,
        p.pe,
        p.pbv,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}

function slug(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "all"
  );
}

/** peer-set_<sector>_<model>_<yyyy-mm-dd>.csv — "all" when sector-wide. */
export function peerSetCsvFilename(
  sector: string,
  businessModel: string | null,
  date = new Date().toISOString().slice(0, 10),
): string {
  return `peer-set_${slug(sector)}_${businessModel ? slug(businessModel) : "all"}_${date}.csv`;
}

/* ------------------------------------------------------------------ */
/* Availability — which sector + model combinations have peer data      */
/* ------------------------------------------------------------------ */

export interface PeerAvailabilityRow {
  sector: string;
  businessModel: string | null;
  peerCount: number;
}

export interface PeerAvailability {
  sets: PeerAvailabilityRow[];
  /** How many startups carry each sector. */
  startupCounts: { sector: string; count: number }[];
}

export type AvailabilityBadge =
  | { kind: "yes"; text: string }
  | { kind: "no"; text: string }
  | { kind: "partial"; text: string };

/**
 * Availability for one option of the business model picker, scoped to the
 * sector already chosen. `model === null` is the "Not set" option: it matches
 * only a sector-wide set.
 */
export function modelAvailability(
  availability: PeerAvailability | undefined,
  sector: string | null,
  model: string | null,
): AvailabilityBadge | null {
  if (!availability || !sector) return null;
  const inSector = availability.sets.filter((s) => s.sector === sector);
  const own = inSector.find((s) => (s.businessModel ?? null) === model);
  if (own) return { kind: "yes", text: `${own.peerCount} peers` };
  if (model === null) {
    // Sets exist for this sector, but none is sector-wide — leaving the model
    // blank will not match anything. That is the amber state.
    return inSector.length > 0
      ? { kind: "partial", text: "no sector-wide set" }
      : { kind: "no", text: "no peer set" };
  }
  return { kind: "no", text: "no set" };
}
