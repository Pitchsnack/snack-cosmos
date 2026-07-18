/**
 * Default Intake — adapter façade.
 *
 * Selects the active adapter (Preview or Backend) based on
 * `VITE_DEFAULT_INTAKE_MODE`. The UI imports ONLY from this module; it
 * must never depend on a concrete adapter implementation.
 *
 * Preserves the platform invariant:
 *   One Request → One Active Tenant → One Database
 * Frontend tenant selection never chooses the physical database. The API
 * Gateway and Database Router remain the routing authorities.
 */
import { useSyncExternalStore } from "react";
import { createPreviewAdapter } from "./preview-adapter";
import { createBackendAdapter } from "./backend-adapter";
import type {
  DefaultIntakeAdapter,
  DefaultIntakeConfiguration,
  DefaultIntakeMode,
  DefaultIntakeQueueRecord,
} from "./types";

export type {
  DefaultIntakeAdapter,
  DefaultIntakeAgent,
  DefaultIntakeConfiguration,
  DefaultIntakeDomain,
  DefaultIntakeActorType,
  DefaultIntakeMode,
  DefaultIntakeQueueRecord,
  DefaultIntakeQueueSource,
  ReassignInput,
  BulkReassignInput,
  BulkReassignItem,
} from "./types";

// ---------------------------------------------------------------------------
// Feature-flag + mode selection
// ---------------------------------------------------------------------------

/**
 * Temporary CONTROL-only toggle key. The design phase can flip the flag
 * without an environment redeploy. Client-only, evaluated at module load,
 * reload-based. Does NOT change backend behavior and will be removed once
 * the design is done.
 */
export const DEFAULT_INTAKE_PREVIEW_OVERRIDE_KEY =
  "lovable.defaultIntakePreview.override" as const;

function readOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(DEFAULT_INTAKE_PREVIEW_OVERRIDE_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  } catch {
    return null;
  }
}

const ENV_ENABLED = import.meta.env.VITE_DEFAULT_INTAKE_PREVIEW === "true";
const OVERRIDE = readOverride();

export const DEFAULT_INTAKE_ENABLED: boolean =
  OVERRIDE === null ? ENV_ENABLED : OVERRIDE;

/** Kept for backwards compatibility with the earlier preview-only naming. */
export const DEFAULT_INTAKE_PREVIEW_ENABLED = DEFAULT_INTAKE_ENABLED;

export function setDefaultIntakePreviewOverride(enabled: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled === null) {
      window.localStorage.removeItem(DEFAULT_INTAKE_PREVIEW_OVERRIDE_KEY);
    } else {
      window.localStorage.setItem(
        DEFAULT_INTAKE_PREVIEW_OVERRIDE_KEY,
        enabled ? "true" : "false",
      );
    }
    window.location.reload();
  } catch {
    /* noop */
  }
}

const RAW_MODE = (import.meta.env.VITE_DEFAULT_INTAKE_MODE as string | undefined)?.toLowerCase();
export const DEFAULT_INTAKE_MODE: DefaultIntakeMode =
  RAW_MODE === "backend" ? "backend" : "preview";

// ---------------------------------------------------------------------------
// Adapter binding
// ---------------------------------------------------------------------------

export const defaultIntakeAdapter: DefaultIntakeAdapter =
  DEFAULT_INTAKE_MODE === "backend"
    ? createBackendAdapter(DEFAULT_INTAKE_ENABLED)
    : createPreviewAdapter(DEFAULT_INTAKE_ENABLED);

// Legacy top-level helpers — thin wrappers so existing call sites keep
// working while new code uses `defaultIntakeAdapter.*`.
export function isDefaultIntakePreviewId(value: string | null | undefined): boolean {
  return defaultIntakeAdapter.isFixtureId(value);
}

export function assertNoDefaultIntakePreviewIds(
  values: Array<string | null | undefined>,
): void {
  defaultIntakeAdapter.assertNoFixtureIds(values);
}

export function getDefaultIntakePreviewConfiguration(): DefaultIntakeConfiguration | null {
  return defaultIntakeAdapter.getConfiguration();
}

export function listDefaultIntakePreviewQueue(): DefaultIntakeQueueRecord[] {
  return defaultIntakeAdapter.listQueue();
}

// Backwards-compat: the preview-adapter is the source of the fixture id
// prefix constant used in a couple of legacy spots.
export { DEFAULT_INTAKE_FIXTURE_PREFIX } from "./preview-adapter";

// ---------------------------------------------------------------------------
// React hooks that subscribe to adapter state changes
// ---------------------------------------------------------------------------

export function useDefaultIntakeQueue(): DefaultIntakeQueueRecord[] {
  return useSyncExternalStore(
    (cb) => defaultIntakeAdapter.subscribe(cb),
    () => defaultIntakeAdapter.listQueue(),
    () => defaultIntakeAdapter.listQueue(),
  );
}

export function useDefaultIntakeConfiguration(): DefaultIntakeConfiguration | null {
  return useSyncExternalStore(
    (cb) => defaultIntakeAdapter.subscribe(cb),
    () => defaultIntakeAdapter.getConfiguration(),
    () => defaultIntakeAdapter.getConfiguration(),
  );
}
