/**
 * PRD 01 — Default Intake Preview Foundation.
 *
 * Pure, presentation-only preview adapter. Provides fixture Default Intake
 * configuration and queue records for UI development BEFORE any backend
 * ownership, settings, permissions, audit, queue, migration, or Database
 * Router contracts exist.
 *
 * Hard rules:
 *  - No fetch / Supabase / server functions / API Gateway / Database Router.
 *  - No localStorage / sessionStorage / cookies.
 *  - No TanStack Query cache access, no session context, no navigation.
 *  - Startup Intake AI and Investor Intake AI fixtures MUST stay separate.
 *  - Fixture IDs must never reach server boundaries — enforced by
 *    `assertNoDefaultIntakePreviewIds`.
 */

export const DEFAULT_INTAKE_PREVIEW_ENABLED: boolean =
  import.meta.env.VITE_DEFAULT_INTAKE_PREVIEW === "true";

export const DEFAULT_INTAKE_FIXTURE_PREFIX = "fixture-default-intake-" as const;

export type DefaultIntakeDomain = "startup" | "investor";
export type DefaultIntakeActorType = "human" | "ai";

export interface DefaultIntakePreviewAgent {
  id: string;
  name: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
  tenantId: string;
  active: true;
  preview: true;
}

export interface DefaultIntakePreviewConfiguration {
  tenantId: string;
  startup: {
    humanAgent: DefaultIntakePreviewAgent;
    aiAgent: DefaultIntakePreviewAgent;
  };
  investor: {
    humanAgent: DefaultIntakePreviewAgent;
    aiAgent: DefaultIntakePreviewAgent;
  };
  preview: true;
}

export type DefaultIntakeQueueSource =
  | "manual_entry"
  | "bulk_import"
  | "relationship_created"
  | "auto_enrich";

export interface DefaultIntakePreviewQueueRecord {
  id: string;
  tenantId: string;
  domain: DefaultIntakeDomain;
  name: string;
  humanOwner: DefaultIntakePreviewAgent;
  aiOwner: DefaultIntakePreviewAgent;
  source: DefaultIntakeQueueSource;
  createdAt: string;
  needsReassignment: true;
  preview: true;
}

// ---------------------------------------------------------------------------
// Fixture identifiers (dedicated prefix, no real UUIDs, no reuse of
// fixture-preview-* tenant IDs).
// ---------------------------------------------------------------------------

const TENANT_ID = "fixture-default-intake-tenant-acme";

const STARTUP_HUMAN_ID = "fixture-default-intake-startup-human-sarah-chen";
const STARTUP_AI_ID = "fixture-default-intake-startup-ai-analysis";
const INVESTOR_HUMAN_ID = "fixture-default-intake-investor-human-david-lim";
const INVESTOR_AI_ID = "fixture-default-intake-investor-ai-mandate";

const QUEUE_TREETOSCOPE_ID = "fixture-default-intake-startup-treetoscope";
const QUEUE_SUPERDATA_ID = "fixture-default-intake-startup-superdata";
const QUEUE_TEST1B_ID = "fixture-default-intake-investor-test1b";

// ---------------------------------------------------------------------------
// Recursive deep-freeze so consuming UI cannot mutate the source fixture set
// even if it bypasses `structuredClone` (e.g. keeps a reference from a debug
// path). Public reads still always return cloned data.
// ---------------------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

const STARTUP_HUMAN_AGENT: DefaultIntakePreviewAgent = deepFreeze({
  id: STARTUP_HUMAN_ID,
  name: "Sarah Chen",
  actorType: "human",
  domain: "startup",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const STARTUP_AI_AGENT: DefaultIntakePreviewAgent = deepFreeze({
  id: STARTUP_AI_ID,
  name: "Startup Analysis AI",
  actorType: "ai",
  domain: "startup",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const INVESTOR_HUMAN_AGENT: DefaultIntakePreviewAgent = deepFreeze({
  id: INVESTOR_HUMAN_ID,
  name: "David Lim",
  actorType: "human",
  domain: "investor",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const INVESTOR_AI_AGENT: DefaultIntakePreviewAgent = deepFreeze({
  id: INVESTOR_AI_ID,
  name: "Investor Mandate AI",
  actorType: "ai",
  domain: "investor",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const FIXTURE_CONFIGURATION: DefaultIntakePreviewConfiguration = deepFreeze({
  tenantId: TENANT_ID,
  startup: {
    humanAgent: STARTUP_HUMAN_AGENT,
    aiAgent: STARTUP_AI_AGENT,
  },
  investor: {
    humanAgent: INVESTOR_HUMAN_AGENT,
    aiAgent: INVESTOR_AI_AGENT,
  },
  preview: true,
});

// Deterministic ISO strings — no Date.now() so fixtures stay reproducible.
const FIXTURE_QUEUE: readonly DefaultIntakePreviewQueueRecord[] = deepFreeze([
  {
    id: QUEUE_TREETOSCOPE_ID,
    tenantId: TENANT_ID,
    domain: "startup",
    name: "Treetoscope",
    humanOwner: STARTUP_HUMAN_AGENT,
    aiOwner: STARTUP_AI_AGENT,
    source: "manual_entry",
    createdAt: "2026-07-01T09:00:00.000Z",
    needsReassignment: true,
    preview: true,
  },
  {
    id: QUEUE_SUPERDATA_ID,
    tenantId: TENANT_ID,
    domain: "startup",
    name: "Superdata",
    humanOwner: STARTUP_HUMAN_AGENT,
    aiOwner: STARTUP_AI_AGENT,
    source: "auto_enrich",
    createdAt: "2026-07-02T10:30:00.000Z",
    needsReassignment: true,
    preview: true,
  },
  {
    id: QUEUE_TEST1B_ID,
    tenantId: TENANT_ID,
    domain: "investor",
    name: "Test1B",
    humanOwner: INVESTOR_HUMAN_AGENT,
    aiOwner: INVESTOR_AI_AGENT,
    source: "relationship_created",
    createdAt: "2026-07-03T14:15:00.000Z",
    needsReassignment: true,
    preview: true,
  },
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isDefaultIntakePreviewId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(DEFAULT_INTAKE_FIXTURE_PREFIX);
}

function clone<T>(value: T): T {
  // structuredClone is available in all supported browsers and the Worker
  // runtime; no polyfill needed.
  return structuredClone(value);
}

export function getDefaultIntakePreviewConfiguration(): DefaultIntakePreviewConfiguration | null {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;
  return clone(FIXTURE_CONFIGURATION);
}

export function listDefaultIntakePreviewQueue(): DefaultIntakePreviewQueueRecord[] {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return [];
  return clone(FIXTURE_QUEUE) as DefaultIntakePreviewQueueRecord[];
}

/**
 * Throws if any of the provided values is a Default Intake preview fixture ID.
 * Call at every future server-boundary crossing (create/update/reassign/etc.)
 * BEFORE dispatching to `createServerFn` handlers. Never logs payloads.
 */
export function assertNoDefaultIntakePreviewIds(values: Array<string | null | undefined>): void {
  for (const v of values) {
    if (isDefaultIntakePreviewId(v)) {
      throw new Error("Default Intake preview fixture IDs must not be sent to server functions.");
    }
  }
}
