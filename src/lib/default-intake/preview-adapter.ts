/**
 * Default Intake — Preview Adapter.
 *
 * Fixture-only implementation of `DefaultIntakeAdapter`. Provides:
 *  - immutable fixture Configuration + Queue seed
 *  - an in-memory mutable overlay for reassignments so the UI can
 *    demonstrate state changes; overlay is reset on page refresh
 *  - a subscription mechanism for React consumers
 *
 * Hard rules (unchanged from PRD 01):
 *  - No fetch / Supabase / server functions / API Gateway / Database Router.
 *  - No localStorage / sessionStorage / cookies (module-load flag override
 *    is the only exception and lives in `index.ts`).
 *  - Startup Intake AI and Investor Intake AI stay separate.
 *  - Fixture IDs never reach server functions — enforced by
 *    `assertNoFixtureIds`.
 */
import type {
  BulkReassignInput,
  DefaultIntakeAdapter,
  DefaultIntakeAgent,
  DefaultIntakeConfiguration,
  DefaultIntakeQueueRecord,
  ReassignInput,
} from "./types";

export const DEFAULT_INTAKE_FIXTURE_PREFIX = "fixture-default-intake-" as const;

// ---------------------------------------------------------------------------
// Fixture identifiers
// ---------------------------------------------------------------------------
const TENANT_ID = "fixture-default-intake-tenant-acme";

const STARTUP_HUMAN_ID = "fixture-default-intake-startup-human-sarah-chen";
const STARTUP_AI_ID = "fixture-default-intake-startup-ai-analysis";
const INVESTOR_HUMAN_ID = "fixture-default-intake-investor-human-david-lim";
const INVESTOR_AI_ID = "fixture-default-intake-investor-ai-mandate";

const QUEUE_TREETOSCOPE_ID = "fixture-default-intake-startup-treetoscope";
const QUEUE_SUPERDATA_ID = "fixture-default-intake-startup-superdata";
const QUEUE_TEST1B_ID = "fixture-default-intake-investor-test1b";

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

const STARTUP_HUMAN_AGENT: DefaultIntakeAgent = deepFreeze({
  id: STARTUP_HUMAN_ID,
  name: "Sarah Chen",
  actorType: "human",
  domain: "startup",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const STARTUP_AI_AGENT: DefaultIntakeAgent = deepFreeze({
  id: STARTUP_AI_ID,
  name: "Startup Analysis AI",
  actorType: "ai",
  domain: "startup",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const INVESTOR_HUMAN_AGENT: DefaultIntakeAgent = deepFreeze({
  id: INVESTOR_HUMAN_ID,
  name: "David Lim",
  actorType: "human",
  domain: "investor",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const INVESTOR_AI_AGENT: DefaultIntakeAgent = deepFreeze({
  id: INVESTOR_AI_ID,
  name: "Investor Mandate AI",
  actorType: "ai",
  domain: "investor",
  tenantId: TENANT_ID,
  active: true,
  preview: true,
});

const FIXTURE_CONFIGURATION: DefaultIntakeConfiguration = deepFreeze({
  tenantId: TENANT_ID,
  startup: { humanAgent: STARTUP_HUMAN_AGENT, aiAgent: STARTUP_AI_AGENT },
  investor: { humanAgent: INVESTOR_HUMAN_AGENT, aiAgent: INVESTOR_AI_AGENT },
  preview: true,
});

const FIXTURE_QUEUE: readonly DefaultIntakeQueueRecord[] = deepFreeze([
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// In-memory mutable overlay (reset on page refresh)
// ---------------------------------------------------------------------------
const reassignedIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------
export function createPreviewAdapter(enabled: boolean): DefaultIntakeAdapter {
  function isFixtureId(value: string | null | undefined): boolean {
    return typeof value === "string" && value.startsWith(DEFAULT_INTAKE_FIXTURE_PREFIX);
  }

  function assertNoFixtureIds(values: Array<string | null | undefined>): void {
    for (const v of values) {
      if (isFixtureId(v)) {
        throw new Error(
          "Default Intake preview fixture IDs must not be sent to server functions.",
        );
      }
    }
  }

  return {
    mode: "preview",
    enabled,

    isFixtureId,
    assertNoFixtureIds,

    getConfiguration() {
      if (!enabled) return null;
      return clone(FIXTURE_CONFIGURATION);
    },

    listQueue() {
      if (!enabled) return [];
      return clone(FIXTURE_QUEUE).filter((r) => !reassignedIds.has(r.id));
    },

    async reassign(input: ReassignInput) {
      if (!enabled) return;
      // Domain safety: Startup AI and Investor AI must remain separate.
      // The dialogs already scope their AI options per domain; this is a
      // defensive assertion. Fixture names are shipped as static strings so
      // we tag them by the leading token.
      if (input.domain === "startup" && /investor/i.test(input.newAiOwnerName)) {
        throw new Error("Startup records cannot be assigned an Investor AI owner.");
      }
      if (input.domain === "investor" && /startup/i.test(input.newAiOwnerName)) {
        throw new Error("Investor records cannot be assigned a Startup AI owner.");
      }
      reassignedIds.add(input.recordId);
      notify();
    },

    async bulkReassign(input: BulkReassignInput) {
      if (!enabled) return;
      for (const it of input.items) {
        reassignedIds.add(it.recordId);
      }
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
