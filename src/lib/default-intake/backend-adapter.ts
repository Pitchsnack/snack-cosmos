/**
 * Default Intake — Backend Adapter (CONTRACT STUB).
 *
 * Contract-compatible with the transitional adapter. When the API Gateway
 * + Database Router integration is approved, this module is replaced.
 * Until then every read returns a controlled unavailability envelope and
 * every write throws `FEATURE_NOT_AVAILABLE`. The canonical UI treats both
 * paths identically — only the adapter changes.
 */
import { assertNoFixtureIds, isFixtureId } from "./guards";
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
import { DefaultIntakeError } from "./types";

const UNAVAILABLE: DefaultIntakeCapability<never> = Object.freeze({
  available: false,
  reason:
    "The Backend Adapter (API Gateway + Database Router) is not yet approved. Keep VITE_DEFAULT_INTAKE_MODE=transitional.",
  code: "FEATURE_NOT_AVAILABLE",
}) as DefaultIntakeCapability<never>;

function unavailable(): never {
  throw new DefaultIntakeError("FEATURE_NOT_AVAILABLE", UNAVAILABLE.available === false ? UNAVAILABLE.reason : "");
}

export function createBackendAdapter(): DefaultIntakeAdapter {
  return {
    mode: "backend",
    isFixtureId,
    assertNoFixtureIds,
    async getConfiguration(): Promise<DefaultIntakeConfiguration | null> {
      return null;
    },
    async listEligibleAgents(): Promise<EligibleDefaultIntakeAgents> {
      return { startupHumans: [], startupAis: [], investorHumans: [], investorAis: [] };
    },
    async upsertConfiguration(_input: UpsertDefaultIntakeSettingsInput) {
      unavailable();
    },
    async createTenantAiAgent(_input: CreateTenantAiAgentInput): Promise<EligibleDefaultIntakeAgent> {
      unavailable();
    },
    async listQueue(): Promise<DefaultIntakeCapability<DefaultIntakeQueueItem[]>> {
      return UNAVAILABLE;
    },
    async reassign(_input: ReassignInput) {
      return UNAVAILABLE;
    },
    async bulkReassign(_input: BulkReassignInput) {
      return UNAVAILABLE;
    },
  };
}
