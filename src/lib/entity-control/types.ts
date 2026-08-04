/**
 * Entity Control — logical types.
 *
 * The UI speaks in logical references only. Physical database routing
 * (Control DB / Tenant DBs) stays behind the SnackPortal API layer.
 */

export type EntityKind = "startup" | "investor";

/** Directory publication state as shown in the Control list. */
export type DirectoryState = "published" | "unpublished";

export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  /** True when `total` is an estimate rather than an exact count. */
  approximate?: boolean;
}

export interface ControlListParams {
  page: number;
  pageSize: number;
  q?: string;
  status?: "all" | DirectoryState;
  /** Startups: industry. Investors: sector focus. */
  facet?: string;
  /** Investors only: investor type. */
  type?: string;
  /** Investors only: stage focus. */
  stage?: string;
  country?: string;
  updated?: "any" | "7d" | "30d" | "90d";
  sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc";
}

export interface ControlStartupRow {
  id: string;
  name: string;
  short_description: string | null;
  logo_url: string | null;
  industry: string[];
  location: string | null;
  updated_at: string;
  directory_state: DirectoryState;
}

export interface ControlInvestorRow {
  id: string;
  name: string;
  investor_type: string | null;
  stages: string[];
  sectors: string[];
  location: string | null;
  logo_url: string | null;
  updated_at: string;
  directory_state: DirectoryState;
}

/* ---------------------------------------------------------------------- */
/* AI Draft Extraction                                                     */
/* ---------------------------------------------------------------------- */

export type DraftReviewStatus =
  | "pending_review"
  | "needs_review"
  | "approved"
  | "rejected"
  | "duplicate_suspected"
  | "conflict_detected"
  | "incomplete";

export interface DraftField {
  label: string;
  value: string;
  confidence: number;
}

export interface DraftRecord {
  draft_ref: string;
  entity_kind: EntityKind;
  name: string;
  website: string;
  source: string;
  country: string;
  confidence: number;
  extracted_at: string;
  status: DraftReviewStatus;
  summary: { label: string; value: string }[];
  fields: DraftField[];
  source_url: string;
  issues: string[];
  duplicate_of: string | null;
}

export interface DraftListParams {
  kind: EntityKind;
  page: number;
  pageSize: number;
  q?: string;
  source?: string;
  status?: DraftReviewStatus | "all";
  confidence?: "all" | "high" | "medium" | "low";
  extracted?: "any" | "24h" | "7d" | "30d";
}

export interface DraftSummary {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  needsHumanReview: number;
}
