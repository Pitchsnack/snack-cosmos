/**
 * investorStartupLinksAdapter
 * -----------------------------------------------------------------------------
 * Frontend adapter boundary for Investor ↔ Startup Links V3.
 *
 * UI-only. No supabase.from(...), no supabase.functions.invoke(...), no new
 * server functions, no new tables, no RLS/grants, no migrations.
 *
 * The editor component owns useServerFn wiring for existing permission-guarded
 * read-only list functions (listInvestors / listStartups). This adapter only
 * maps returned rows into view DTOs and provides pure duplicate-detection
 * helpers plus stubbed get/save entry points.
 *
 * Every stub get/save is a no-op with:
 *   // TODO: wire to SnackPortal2 API Gateway
 */

import type {
  DuplicateCandidate,
  DuplicateCheckResult,
  InvestorPortfolioEntryView,
  InvestorStartupRelationshipType,
  StartupInvestorLinkView,
} from "./investor-startup-links-types";

// -----------------------------------------------------------------------------
// Mapping helpers — convert existing list-fn row shapes into view DTOs.
// -----------------------------------------------------------------------------

/** Minimal shape needed from `listInvestors` results. */
export interface InvestorSearchRow {
  id: string;
  investor_name: string;
  investor_type: string | null;
  country: string | null;
}

/** Minimal shape needed from `listStartups` result items. */
export interface StartupSearchRow {
  id: string;
  startup_name: string;
  industry: string[] | null;
}

export function toStartupInvestorLinkView(
  row: InvestorSearchRow,
  opts?: { relationshipType?: InvestorStartupRelationshipType },
): StartupInvestorLinkView {
  return {
    id: row.id,
    investorId: row.id,
    investorName: row.investor_name,
    investorType: row.investor_type,
    country: row.country,
    relationshipType: opts?.relationshipType ?? "investment",
    status: "linked",
  };
}

export function toInvestorPortfolioEntryView(
  row: StartupSearchRow,
  opts?: { relationshipType?: InvestorStartupRelationshipType },
): InvestorPortfolioEntryView {
  return {
    id: row.id,
    startupId: row.id,
    companyName: row.startup_name,
    industry: row.industry?.[0] ?? null,
    relationshipType: opts?.relationshipType ?? "investment",
    status: "linked",
  };
}

// -----------------------------------------------------------------------------
// Duplicate detection — pure client-side, per PRD §9.3.
//   - lowercase
//   - strip non-alphanumeric
//   - exact match first
//   - then substring both ways
//   - or same first 3 chars and length difference ≤ 2
// -----------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface Candidate {
  id: string | null;
  name: string;
  subtitle?: string | null;
}

function detectDuplicates(name: string, candidates: Candidate[]): DuplicateCheckResult {
  const target = normalize(name);
  if (!target) return { candidates: [], hasExact: false };

  const out: DuplicateCandidate[] = [];
  let hasExact = false;

  for (const c of candidates) {
    const n = normalize(c.name);
    if (!n) continue;
    if (n === target) {
      out.push({ id: c.id, name: c.name, subtitle: c.subtitle ?? null, matchKind: "exact" });
      hasExact = true;
      continue;
    }
    if (n.includes(target) || target.includes(n)) {
      out.push({ id: c.id, name: c.name, subtitle: c.subtitle ?? null, matchKind: "substring" });
      continue;
    }
    if (
      n.slice(0, 3) === target.slice(0, 3) &&
      Math.abs(n.length - target.length) <= 2
    ) {
      out.push({ id: c.id, name: c.name, subtitle: c.subtitle ?? null, matchKind: "prefix" });
    }
  }

  // Order: exact → substring → prefix, dedupe by id/name.
  const rank = (k: DuplicateCandidate["matchKind"]) =>
    k === "exact" ? 0 : k === "substring" ? 1 : 2;
  out.sort((a, b) => rank(a.matchKind) - rank(b.matchKind));

  const seen = new Set<string>();
  const deduped = out.filter((c) => {
    const key = (c.id ?? "") + "|" + normalize(c.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { candidates: deduped, hasExact };
}

// -----------------------------------------------------------------------------
// Adapter object.
// -----------------------------------------------------------------------------

export const investorStartupLinksAdapter = {
  // ---- Mapping (re-exposed on the adapter for ergonomic call-sites) ----
  toStartupInvestorLinkView,
  toInvestorPortfolioEntryView,

  // ---- Duplicate detection ----

  checkInvestorDuplicates(
    name: string,
    candidates: Array<{ id: string; investor_name: string; investor_type?: string | null }>,
  ): DuplicateCheckResult {
    return detectDuplicates(
      name,
      candidates.map((c) => ({
        id: c.id,
        name: c.investor_name,
        subtitle: c.investor_type ?? null,
      })),
    );
  },

  checkStartupDuplicates(
    name: string,
    candidates: Array<{ id: string; startup_name: string; industry?: string[] | null }>,
  ): DuplicateCheckResult {
    return detectDuplicates(
      name,
      candidates.map((c) => ({
        id: c.id,
        name: c.startup_name,
        subtitle: c.industry?.[0] ?? null,
      })),
    );
  },

  // ---- Stubbed get/save — future SnackPortal2 API Gateway ----

  async getStartupInvestorRelationships(
    _startupId: string,
  ): Promise<StartupInvestorLinkView[]> {
    // TODO: wire to SnackPortal2 API Gateway
    return [];
  },

  async saveStartupInvestorRelationships(
    _startupId: string,
    _links: StartupInvestorLinkView[],
  ): Promise<void> {
    // TODO: wire to SnackPortal2 API Gateway
    return;
  },

  async getInvestorInvestmentPortfolio(
    _investorId: string,
  ): Promise<InvestorPortfolioEntryView[]> {
    // TODO: wire to SnackPortal2 API Gateway
    return [];
  },

  async saveInvestorInvestmentPortfolio(
    _investorId: string,
    _entries: InvestorPortfolioEntryView[],
  ): Promise<void> {
    // TODO: wire to SnackPortal2 API Gateway
    return;
  },
};

export type InvestorStartupLinksAdapter = typeof investorStartupLinksAdapter;
