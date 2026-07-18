/**
 * BACKWARDS-COMPAT SHIM.
 *
 * The canonical Default Intake adapter now lives at
 * `@/lib/default-intake`. This file re-exports the public surface under
 * the historical names so existing imports keep compiling. New code should
 * import from `@/lib/default-intake` directly.
 */
export {
  DEFAULT_INTAKE_ENABLED,
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  DEFAULT_INTAKE_PREVIEW_OVERRIDE_KEY,
  DEFAULT_INTAKE_FIXTURE_PREFIX,
  DEFAULT_INTAKE_MODE,
  defaultIntakeAdapter,
  setDefaultIntakePreviewOverride,
  isDefaultIntakePreviewId,
  assertNoDefaultIntakePreviewIds,
  getDefaultIntakePreviewConfiguration,
  listDefaultIntakePreviewQueue,
  useDefaultIntakeQueue,
  useDefaultIntakeConfiguration,
} from "@/lib/default-intake";

export type {
  DefaultIntakeAdapter,
  DefaultIntakeMode,
  DefaultIntakeAgent as DefaultIntakePreviewAgent,
  DefaultIntakeConfiguration as DefaultIntakePreviewConfiguration,
  DefaultIntakeQueueRecord as DefaultIntakePreviewQueueRecord,
  DefaultIntakeQueueSource as DefaultIntakePreviewQueueSource,
  DefaultIntakeDomain,
  DefaultIntakeActorType,
  ReassignInput,
  BulkReassignInput,
  BulkReassignItem,
} from "@/lib/default-intake";
