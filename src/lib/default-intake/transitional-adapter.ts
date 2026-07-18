/**
 * Default Intake — Transitional Adapter.
 *
 * Bridges the canonical UI to the current (transitional) PostgreSQL
 * environment through authenticated server functions. When the Backend
 * Adapter is authorized, the same canonical UI switches to it without any
 * UI change — only the adapter module changes.
 *
 * Queue features are exposed as controlled unavailability until their
 * backend is approved (see PRD §15). All errors are mapped to
 * `DefaultIntakeError` codes; raw provider strings never reach the UI.
 */
import { assertNoFixtureIds, isFixtureId } from "./guards";
import {
  createTenantAiAgent as createTenantAiAgentFn,
  getDefaultIntakeSettings,
  listEligibleDefaultIntakeAgents,
  upsertDefaultIntakeSettings,
} from "./default-intake.functions";
import type {
  BulkReassignInput,
  CreateTenantAiAgentInput,
  DefaultIntakeAdapter,
  DefaultIntakeCapability,
  DefaultIntakeConfiguration,
  DefaultIntakeErrorCode,
  DefaultIntakeQueueItem,
  EligibleDefaultIntakeAgent,
  EligibleDefaultIntakeAgents,
  ReassignInput,
  UpsertDefaultIntakeSettingsInput,
} from "./types";
import { DefaultIntakeError } from "./types";

function toDefaultIntakeError(e: unknown): DefaultIntakeError {
  if (e instanceof DefaultIntakeError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  // Best-effort mapping of typed messages thrown as plain Error over the wire.
  const codes: DefaultIntakeErrorCode[] = [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "ACTIVE_TENANT_REQUIRED",
    "TENANT_MISMATCH",
    "INELIGIBLE_HUMAN_AGENT",
    "INELIGIBLE_STARTUP_AI_AGENT",
    "INELIGIBLE_INVESTOR_AI_AGENT",
    "FIXTURE_ID_REJECTED",
    "QUEUE_NOT_AVAILABLE",
    "FEATURE_NOT_AVAILABLE",
  ];
  for (const c of codes) if (msg.includes(c)) return new DefaultIntakeError(c, msg);
  return new DefaultIntakeError("UNKNOWN", msg);
}

const QUEUE_UNAVAILABLE = Object.freeze({
  available: false as const,
  reason: "Intake Queue persistence is not available yet.",
  code: "QUEUE_NOT_AVAILABLE" as const,
});

export function createTransitionalAdapter(): DefaultIntakeAdapter {
  return {
    mode: "transitional",
    isFixtureId,
    assertNoFixtureIds,
    async getConfiguration(): Promise<DefaultIntakeConfiguration | null> {
      try {
        return await getDefaultIntakeSettings();
      } catch (e) {
        // A missing configuration is not an error; missing permission is.
        throw toDefaultIntakeError(e);
      }
    },
    async listEligibleAgents(): Promise<EligibleDefaultIntakeAgents> {
      try {
        return await listEligibleDefaultIntakeAgents();
      } catch (e) {
        throw toDefaultIntakeError(e);
      }
    },
    async upsertConfiguration(input: UpsertDefaultIntakeSettingsInput) {
      assertNoFixtureIds([
        input.startupHumanId,
        input.startupAiId,
        input.investorHumanId,
        input.investorAiId,
      ]);
      try {
        return await upsertDefaultIntakeSettings({ data: input });
      } catch (e) {
        throw toDefaultIntakeError(e);
      }
    },
    async createTenantAiAgent(input: CreateTenantAiAgentInput): Promise<EligibleDefaultIntakeAgent> {
      try {
        return await createTenantAiAgentFn({ data: input });
      } catch (e) {
        throw toDefaultIntakeError(e);
      }
    },
    async listQueue(): Promise<DefaultIntakeCapability<DefaultIntakeQueueItem[]>> {
      return QUEUE_UNAVAILABLE;
    },
    async reassign(_input: ReassignInput) {
      return QUEUE_UNAVAILABLE;
    },
    async bulkReassign(_input: BulkReassignInput) {
      return QUEUE_UNAVAILABLE;
    },
  };
}
