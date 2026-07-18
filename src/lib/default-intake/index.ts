/**
 * Default Intake — adapter façade.
 *
 * The canonical UI imports ONLY from this module. Adapter selection is
 * governed by `VITE_DEFAULT_INTAKE_MODE`:
 *
 *   transitional (default): real settings + eligible agents through server fns
 *   mock:                   fixture data — DEV/TEST ONLY, fail-closed in prod
 *   backend:                contract stub — reserved for API Gateway cutover
 *
 * Invariants preserved:
 *  - One Request → One Active Tenant → One Database
 *  - Frontend never selects / stores a physical database name or DSN
 *  - Startup AI and Investor AI stay separate at every layer
 */
import { createTransitionalAdapter } from "./transitional-adapter";
import { createMockAdapter } from "./mock-adapter";
import { createBackendAdapter } from "./backend-adapter";
import type { DefaultIntakeAdapter, DefaultIntakeMode } from "./types";

export * from "./types";
export { FIXTURE_ID_PREFIX, assertNoFixtureIds, isFixtureId } from "./guards";

const RAW_MODE = (import.meta.env.VITE_DEFAULT_INTAKE_MODE as string | undefined)?.toLowerCase();
const IS_PROD = Boolean(import.meta.env.PROD);

function resolveMode(): DefaultIntakeMode {
  if (RAW_MODE === "backend") return "backend";
  if (RAW_MODE === "mock") {
    if (IS_PROD) {
      // Fail closed. Mock mode must never render in production.
      // eslint-disable-next-line no-console
      console.error(
        "[default-intake] VITE_DEFAULT_INTAKE_MODE=mock is not permitted in production. Falling back to transitional.",
      );
      return "transitional";
    }
    return "mock";
  }
  return "transitional";
}

export const DEFAULT_INTAKE_MODE: DefaultIntakeMode = resolveMode();

export const defaultIntakeAdapter: DefaultIntakeAdapter =
  DEFAULT_INTAKE_MODE === "mock"
    ? createMockAdapter()
    : DEFAULT_INTAKE_MODE === "backend"
      ? createBackendAdapter()
      : createTransitionalAdapter();
