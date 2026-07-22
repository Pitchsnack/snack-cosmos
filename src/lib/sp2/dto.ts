/**
 * PRD — SnackPortal2 Lovable Gateway Integration (START-GATE)
 *
 * Frozen backend contract types. Do not extend without a backend contract change.
 */

export type WorkspaceMembershipDTO = {
  tenant_id: string;
  role: string;
};

export type TenantStartupDetailDTO = {
  record_ref: string;
  display_name: string;
  short_description: string | null;
  investment_stage: string | null;
  record_origin: string;
  record_residency: "tenant";
  record_type: "startup";
  lineage_reference: string | null;
};

export type TenantStartupUpdateRequestDTO = {
  short_description: string | null;
};

export const SHORT_DESCRIPTION_MAX = 500;

/** Discriminated Gateway outcome. Maps 1:1 to PRD §7 error table. */
export type GatewayOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized" }        // 401
  | { kind: "forbidden" }           // 403
  | { kind: "not_found" }           // 404
  | { kind: "too_large" }           // 413
  | { kind: "unavailable" }         // 503
  | { kind: "network_error" };      // fetch failure
