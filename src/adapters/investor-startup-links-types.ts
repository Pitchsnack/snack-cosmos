/**
 * Investor ↔ Startup Links V3 — shared view DTOs.
 *
 * UI-only. No backend, no schema, no direct DB access. Persistence is
 * deferred to a future SnackPortal2 API Gateway.
 */

export type InvestorStartupRelationshipType = "investment" | "acquisition";
export type LinkStatus = "linked" | "pending";

/** One row inside Startup Edit → Investor Relationships. */
export interface StartupInvestorLinkView {
  /** Local UI id (uuid or synthetic for pending rows). */
  id: string;
  /** Populated when status === "linked"; null when pending. */
  investorId: string | null;
  /** Display name; always present (denormalized for pending survival). */
  investorName: string;
  investorType: string | null;
  country: string | null;
  relationshipType: InvestorStartupRelationshipType;
  status: LinkStatus;
}

/** One row inside Investor Edit → Investment Portfolio. */
export interface InvestorPortfolioEntryView {
  id: string;
  startupId: string | null;
  companyName: string;
  industry: string | null;
  relationshipType: InvestorStartupRelationshipType;
  status: LinkStatus;
}

/** Duplicate-warning candidate surfaced to the modal. */
export interface DuplicateCandidate {
  /** Existing record id if the candidate resolves to a real row. */
  id: string | null;
  name: string;
  /** "exact" | "substring" | "prefix" — for UI badges/ordering. */
  matchKind: "exact" | "substring" | "prefix";
  subtitle?: string | null;
}

/** Adapter result: duplicate-check output. */
export interface DuplicateCheckResult {
  candidates: DuplicateCandidate[];
  hasExact: boolean;
}
