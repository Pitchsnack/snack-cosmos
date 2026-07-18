/**
 * Default Intake — canonical types shared by every adapter implementation.
 *
 * The UI depends ONLY on this contract. Mock, Transitional, and Backend
 * adapters MUST all satisfy `DefaultIntakeAdapter`. Fixture constants
 * must never leak into UI components; consume adapter results only.
 */

export type DefaultIntakeMode = "mock" | "transitional" | "backend";

export type DefaultIntakeDomain = "startup" | "investor";
export type DefaultIntakeActorType = "human" | "ai";

/** Application-level error codes — vendor-neutral. */
export type DefaultIntakeErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "ACTIVE_TENANT_REQUIRED"
  | "TENANT_MISMATCH"
  | "INELIGIBLE_HUMAN_AGENT"
  | "INELIGIBLE_STARTUP_AI_AGENT"
  | "INELIGIBLE_INVESTOR_AI_AGENT"
  | "FIXTURE_ID_REJECTED"
  | "QUEUE_NOT_AVAILABLE"
  | "FEATURE_NOT_AVAILABLE"
  | "UNKNOWN";

export class DefaultIntakeError extends Error {
  code: DefaultIntakeErrorCode;
  constructor(code: DefaultIntakeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DefaultIntakeError";
  }
}

export interface EligibleDefaultIntakeAgent {
  id: string;
  name: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
  tenantId: string;
  active: boolean;
  /** True only for mock fixtures. Real transitional/backend rows: false. */
  fixture: boolean;
  /** Optional secondary label for the dropdown, e.g. "Tenant Agent". */
  roleLabel?: string | null;
}

export interface DefaultIntakeConfiguration {
  tenantId: string;
  tenantName: string | null;
  startup: {
    humanAgent: EligibleDefaultIntakeAgent;
    aiAgent: EligibleDefaultIntakeAgent;
  };
  investor: {
    humanAgent: EligibleDefaultIntakeAgent;
    aiAgent: EligibleDefaultIntakeAgent;
  };
  fixture: boolean;
  updatedAt: string | null;
}

export interface EligibleDefaultIntakeAgents {
  startupHumans: EligibleDefaultIntakeAgent[];
  startupAis: EligibleDefaultIntakeAgent[];
  investorHumans: EligibleDefaultIntakeAgent[];
  investorAis: EligibleDefaultIntakeAgent[];
}

export interface UpsertDefaultIntakeSettingsInput {
  startupHumanId: string;
  startupAiId: string;
  investorHumanId: string;
  investorAiId: string;
}

export interface DefaultIntakeSaveResult {
  ok: true;
  tenantId: string;
  tenantName: string | null;
}

export interface CreateTenantAiAgentInput {
  displayName: string;
  domain: DefaultIntakeDomain;
}

// --- Queue (kept as controlled unavailability in the transitional slice) ---

export type DefaultIntakeQueueSource =
  | "manual_entry"
  | "bulk_import"
  | "relationship_created"
  | "auto_enrich";

export interface DefaultIntakeQueueItem {
  id: string;
  tenantId: string;
  domain: DefaultIntakeDomain;
  name: string;
  humanOwner: EligibleDefaultIntakeAgent;
  aiOwner: EligibleDefaultIntakeAgent;
  source: DefaultIntakeQueueSource;
  createdAt: string;
  needsReassignment: boolean;
  fixture: boolean;
}

/** Discriminated capability envelope for adapter reads. */
export type DefaultIntakeCapability<T> =
  | { available: true; data: T }
  | { available: false; reason: string; code: DefaultIntakeErrorCode };

export interface ReassignInput {
  recordId: string;
  domain: DefaultIntakeDomain;
  newHumanOwnerName: string;
  /** Domain-scoped AI: Startup→Startup AI only, Investor→Investor AI only. */
  newAiOwnerName: string;
  reason?: string;
}

export interface BulkReassignItem {
  recordId: string;
  domain: DefaultIntakeDomain;
}

export interface BulkReassignInput {
  items: BulkReassignItem[];
  startup?: { newHumanOwnerName: string; newAiOwnerName: string };
  investor?: { newHumanOwnerName: string; newAiOwnerName: string };
  reason?: string;
}

/**
 * The single contract every Default Intake adapter must satisfy.
 * Switching Mock ↔ Transitional ↔ Backend adapters MUST NOT require any
 * UI/UX change.
 */
export interface DefaultIntakeAdapter {
  readonly mode: DefaultIntakeMode;

  isFixtureId(value: string | null | undefined): boolean;
  assertNoFixtureIds(values: Array<string | null | undefined>): void;

  getConfiguration(): Promise<DefaultIntakeConfiguration | null>;
  listEligibleAgents(): Promise<EligibleDefaultIntakeAgents>;
  upsertConfiguration(input: UpsertDefaultIntakeSettingsInput): Promise<DefaultIntakeSaveResult>;
  createTenantAiAgent(input: CreateTenantAiAgentInput): Promise<EligibleDefaultIntakeAgent>;

  listQueue(): Promise<DefaultIntakeCapability<DefaultIntakeQueueItem[]>>;
  reassign(input: ReassignInput): Promise<DefaultIntakeCapability<{ ok: true }>>;
  bulkReassign(input: BulkReassignInput): Promise<DefaultIntakeCapability<{ ok: true }>>;
}
