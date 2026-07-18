/**
 * BACKWARDS-COMPAT SHIM.
 *
 * The canonical Default Intake surface lives at `@/lib/default-intake`.
 * Preview-flag exports have been removed. This file forwards the remaining
 * public types + safety guards so any lingering import compiles cleanly.
 * New code MUST import from `@/lib/default-intake` directly.
 */
export {
  DEFAULT_INTAKE_MODE,
  defaultIntakeAdapter,
  FIXTURE_ID_PREFIX,
  isFixtureId,
  assertNoFixtureIds,
} from "@/lib/default-intake";

export type {
  DefaultIntakeAdapter,
  DefaultIntakeMode,
  DefaultIntakeDomain,
  DefaultIntakeActorType,
  DefaultIntakeCapability,
  DefaultIntakeConfiguration,
  DefaultIntakeErrorCode,
  DefaultIntakeQueueItem,
  DefaultIntakeSaveResult,
  EligibleDefaultIntakeAgent,
  EligibleDefaultIntakeAgents,
  ReassignInput,
  BulkReassignInput,
  BulkReassignItem,
} from "@/lib/default-intake";
