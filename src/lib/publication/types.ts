/**
 * PRD — My Startups / Startup Directory Publication Separation.
 *
 * Logical publication model. This model is deliberately free of any physical
 * storage detail: no database names, no connection details, no physical
 * database identifiers, no routing information. The UI only ever speaks in
 * logical references (startup_ref / tenant_ref / publication_ref).
 *
 * Lovable never decides which physical database stores a record.
 */

/** Logical reference to a founder-owned startup record. */
export type StartupRef = string;
/** Logical reference to a tenant workspace. */
export type TenantRef = string;
/** Logical reference to a directory publication. */
export type PublicationRef = string;

export type PublicationStatus = "private" | "published" | "unpublished";

export interface StartupPublication {
  startup_ref: StartupRef;
  tenant_ref: TenantRef | null;
  publication_ref: PublicationRef | null;
  status: PublicationStatus;
  updated_at: string | null;
}

/**
 * Approved public projection (see PRD §9).
 * Explicit allowlist — defence in depth only. The future backend publication
 * service remains the authoritative field-validation and privacy boundary.
 */
export interface DirectoryProjection {
  startup_ref: StartupRef;
  name: string;
  logo_url: string | null;
  short_description: string | null;
  industry: string[];
  product_tags: string[];
  market_tags: string[];
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  investment_stage: string | null;
}

/** Discriminated outcome for every publication command. */
export type PublicationOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "capability_unavailable"; reason: string }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "error"; reason: string };

export type PublicationMode = "disabled" | "preview" | "gateway";

export interface PublicationAdapter {
  readonly mode: PublicationMode;
  /** True only when the adapter can actually mutate publication state. */
  readonly canMutate: boolean;
  /** Human-readable label for non-production behaviour, or null. */
  readonly previewNotice: string | null;

  getStatus(startupRef: StartupRef): Promise<PublicationOutcome<StartupPublication>>;
  publish(
    startupRef: StartupRef,
    projection: DirectoryProjection,
    tenantRef: TenantRef | null,
  ): Promise<PublicationOutcome<StartupPublication>>;
  unpublish(startupRef: StartupRef): Promise<PublicationOutcome<StartupPublication>>;
}

export const PUBLICATION_ERROR_MESSAGE =
  "We could not update the directory publication. Your startup remains unchanged.";
