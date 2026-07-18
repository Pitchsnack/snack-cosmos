/**
 * Default Intake — canonical types shared by every adapter implementation.
 *
 * These types are the ONLY contract the UI depends on. Preview and Backend
 * adapters must satisfy `DefaultIntakeAdapter`. Do not embed fixture
 * constants in UI components; consume typed adapter results instead.
 */

export type DefaultIntakeMode = "preview" | "backend";

export type DefaultIntakeDomain = "startup" | "investor";
export type DefaultIntakeActorType = "human" | "ai";

export interface DefaultIntakeAgent {
  id: string;
  name: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
  tenantId: string;
  active: boolean;
  /** True only for preview fixtures. Backend rows must set this to false. */
  preview: boolean;
}

export interface DefaultIntakeConfiguration {
  tenantId: string;
  startup: {
    humanAgent: DefaultIntakeAgent;
    aiAgent: DefaultIntakeAgent;
  };
  investor: {
    humanAgent: DefaultIntakeAgent;
    aiAgent: DefaultIntakeAgent;
  };
  /** True only for preview fixtures. */
  preview: boolean;
}

export type DefaultIntakeQueueSource =
  | "manual_entry"
  | "bulk_import"
  | "relationship_created"
  | "auto_enrich";

export interface DefaultIntakeQueueRecord {
  id: string;
  tenantId: string;
  domain: DefaultIntakeDomain;
  name: string;
  humanOwner: DefaultIntakeAgent;
  aiOwner: DefaultIntakeAgent;
  source: DefaultIntakeQueueSource;
  createdAt: string;
  needsReassignment: boolean;
  /** True only for preview fixtures. */
  preview: boolean;
}

export interface ReassignInput {
  recordId: string;
  domain: DefaultIntakeDomain;
  newHumanOwnerName: string;
  /**
   * Domain-scoped AI. Startup records may only receive Startup AI; Investor
   * records may only receive Investor AI. Adapters MUST enforce this.
   */
  newAiOwnerName: string;
  reason?: string;
}

export interface BulkReassignItem {
  recordId: string;
  domain: DefaultIntakeDomain;
}

export interface BulkReassignInput {
  items: BulkReassignItem[];
  /** Applied per-domain by the adapter. */
  startup?: { newHumanOwnerName: string; newAiOwnerName: string };
  investor?: { newHumanOwnerName: string; newAiOwnerName: string };
  reason?: string;
}

/**
 * The single contract every Default Intake adapter must satisfy.
 * Switching between Preview and Backend implementations MUST NOT require
 * any UI/UX change.
 */
export interface DefaultIntakeAdapter {
  readonly mode: DefaultIntakeMode;
  /** Whether the feature is enabled in the current environment. */
  readonly enabled: boolean;

  isFixtureId(value: string | null | undefined): boolean;
  /**
   * Throws if any provided value is a preview fixture id. Adapters that
   * write to a real backend MUST call this before any mutation payload
   * crosses the server boundary.
   */
  assertNoFixtureIds(values: Array<string | null | undefined>): void;

  getConfiguration(): DefaultIntakeConfiguration | null;
  listQueue(): DefaultIntakeQueueRecord[];

  reassign(input: ReassignInput): Promise<void>;
  bulkReassign(input: BulkReassignInput): Promise<void>;

  /** Subscribe to adapter state changes (queue mutations, config updates). */
  subscribe(listener: () => void): () => void;
}
