/**
 * PRD 8 — API Gateway client (Stream A scaffold).
 *
 * SnackPortal2's target architecture (PRD 8) routes ALL data through an
 * external API Gateway + Database Router:
 *
 *     SnackPortal2  ─▶  External API Gateway  ─▶  Database Router
 *                                                    │
 *                            ┌───────────────────────┼───────────────────────┐
 *                            ▼                       ▼                       ▼
 *                       Control DB              ACME DB                 ZETA DB
 *
 * The Gateway and Router live OUTSIDE Lovable. This module is the single
 * seam in the frontend where that future swap happens. Today every method
 * delegates to a local TanStack server function so the UI can ship now.
 * When the external Gateway lands, only this file changes — call sites,
 * hooks, and components stay the same.
 *
 * Anti-vendor-lock-in rule: this client MUST NOT expose Supabase types,
 * Lovable-specific identifiers, or database column shapes downstream.
 * Everything is plain DTOs.
 */

import {
  listGlobalStartups,
  listGlobalInvestors,
  listGlobalDeals,
  listImportTargets,
  importFromGlobalStub,
  type GlobalStartupDTO,
  type GlobalInvestorDTO,
  type GlobalDealDTO,
  type ImportTargetDTO,
  type ImportRequest,
  type ImportResult,
  type ImportEntity,
} from "@/lib/global-directory.functions";

export type {
  GlobalStartupDTO,
  GlobalInvestorDTO,
  GlobalDealDTO,
  ImportTargetDTO,
  ImportRequest,
  ImportResult,
  ImportEntity,
};

/**
 * Single object the UI talks to. Swap the implementation here when the
 * external Gateway is live (e.g. `fetch('https://gateway.snackportal.dev/...')`).
 */
export const gateway = {
  global: {
    /** STUB — future: GET {gateway}/control/startups */
    listStartups: () => listGlobalStartups(),
    /** STUB — future: GET {gateway}/control/investors */
    listInvestors: () => listGlobalInvestors(),
    /** STUB — future: GET {gateway}/control/deals */
    listDeals: () => listGlobalDeals(),
  },
  tenants: {
    /** STUB — future: GET {gateway}/control/tenants?for=import */
    listImportTargets: () => listImportTargets(),
  },
  import: {
    /**
     * STUB — future: POST {gateway}/import
     *
     * This MUST NOT write to the local database. Per PRD 8, import-copy
     * is owned by the external Import Engine which creates a fully
     * independent tenant record. The frontend only records intent.
     */
    fromGlobal: (req: ImportRequest) =>
      importFromGlobalStub({ data: req }) as Promise<ImportResult>,
  },
} as const;

export type Gateway = typeof gateway;
