/**
 * Default Intake — Mock Adapter.
 *
 * Development + automated-testing use ONLY. Never enabled through the
 * production UI. All identifiers use `FIXTURE_ID_PREFIX` so
 * `assertNoFixtureIds` can reject them defensively at every mutation site.
 */
import { FIXTURE_ID_PREFIX, assertNoFixtureIds, isFixtureId } from "./guards";
import type {
  BulkReassignInput,
  CreateTenantAiAgentInput,
  DefaultIntakeAdapter,
  DefaultIntakeCapability,
  DefaultIntakeConfiguration,
  DefaultIntakeQueueItem,
  EligibleDefaultIntakeAgent,
  EligibleDefaultIntakeAgents,
  ReassignInput,
  UpsertDefaultIntakeSettingsInput,
} from "./types";

const TENANT_ID = `${FIXTURE_ID_PREFIX}tenant-acme`;

function agent(
  slug: string,
  name: string,
  actorType: "human" | "ai",
  domain: "startup" | "investor",
  roleLabel: string,
): EligibleDefaultIntakeAgent {
  return Object.freeze({
    id: `${FIXTURE_ID_PREFIX}${slug}`,
    name,
    actorType,
    domain,
    tenantId: TENANT_ID,
    active: true,
    fixture: true,
    roleLabel,
  });
}

const S_HUMAN = agent("startup-human-sarah-chen", "Sarah Chen", "human", "startup", "Tenant Agent");
const S_AI = agent("startup-ai-analysis", "Startup Analysis AI", "ai", "startup", "TENANT_STARTUP_AI");
const I_HUMAN = agent("investor-human-david-lim", "David Lim", "human", "investor", "Tenant Agent");
const I_AI = agent("investor-ai-mandate", "Investor Mandate AI", "ai", "investor", "TENANT_INVESTOR_AI");

const CFG: DefaultIntakeConfiguration = Object.freeze({
  tenantId: TENANT_ID,
  tenantName: "Acme Ventures (mock)",
  startup: { humanAgent: S_HUMAN, aiAgent: S_AI },
  investor: { humanAgent: I_HUMAN, aiAgent: I_AI },
  fixture: true,
  updatedAt: "2026-07-15T09:00:00.000Z",
});

const QUEUE: readonly DefaultIntakeQueueItem[] = Object.freeze([
  {
    id: `${FIXTURE_ID_PREFIX}startup-treetoscope`,
    tenantId: TENANT_ID,
    domain: "startup",
    name: "Treetoscope",
    humanOwner: S_HUMAN,
    aiOwner: S_AI,
    source: "manual_entry",
    createdAt: "2026-07-01T09:00:00.000Z",
    needsReassignment: true,
    fixture: true,
  },
]);

function clone<T>(v: T): T {
  return structuredClone(v);
}

export function createMockAdapter(): DefaultIntakeAdapter {
  const removed = new Set<string>();
  return {
    mode: "mock",
    isFixtureId,
    assertNoFixtureIds,
    async getConfiguration() {
      return clone(CFG);
    },
    async listEligibleAgents(): Promise<EligibleDefaultIntakeAgents> {
      return {
        startupHumans: [clone(S_HUMAN)],
        startupAis: [clone(S_AI)],
        investorHumans: [clone(I_HUMAN)],
        investorAis: [clone(I_AI)],
      };
    },
    async upsertConfiguration(_input: UpsertDefaultIntakeSettingsInput) {
      assertNoFixtureIds([
        _input.startupHumanId,
        _input.startupAiId,
        _input.investorHumanId,
        _input.investorAiId,
      ]);
      return { ok: true, tenantId: TENANT_ID, tenantName: CFG.tenantName };
    },
    async createTenantAiAgent(input: CreateTenantAiAgentInput) {
      return agent(
        `ai-${input.domain}-${Date.now()}`,
        input.displayName,
        "ai",
        input.domain,
        input.domain === "startup" ? "TENANT_STARTUP_AI" : "TENANT_INVESTOR_AI",
      );
    },
    async listQueue(): Promise<DefaultIntakeCapability<DefaultIntakeQueueItem[]>> {
      return {
        available: true,
        data: clone(QUEUE).filter((r) => !removed.has(r.id)),
      };
    },
    async reassign(input: ReassignInput) {
      removed.add(input.recordId);
      return { available: true as const, data: { ok: true as const } };
    },
    async bulkReassign(input: BulkReassignInput) {
      for (const it of input.items) removed.add(it.recordId);
      return { available: true as const, data: { ok: true as const } };
    },
  };
}
