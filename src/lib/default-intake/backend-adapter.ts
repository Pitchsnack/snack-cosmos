/**
 * Default Intake — Backend Adapter (STUB).
 *
 * Placeholder implementation that satisfies `DefaultIntakeAdapter` typewise
 * but is intentionally not wired to any server function, database, storage,
 * or session code. It will be replaced when backend contracts (ownership,
 * settings, permissions, audit, queue, migration, Database Router) are
 * approved.
 *
 * Selecting this adapter requires:
 *   - VITE_DEFAULT_INTAKE_MODE=backend
 *   - approved backend contracts
 *   - the API Gateway + Database Router as routing authorities
 *
 * DO NOT call the stub methods from UI. The mode switch defaults to
 * `preview`; the backend adapter is exported here only so the boundary is
 * real and reviewable.
 */
import type {
  BulkReassignInput,
  DefaultIntakeAdapter,
  DefaultIntakeConfiguration,
  DefaultIntakeQueueRecord,
  ReassignInput,
} from "./types";

function notImplemented(op: string): never {
  throw new Error(
    `Default Intake backend adapter is not implemented yet (${op}). ` +
      "Backend contracts have not been approved. Keep VITE_DEFAULT_INTAKE_MODE=preview.",
  );
}

export function createBackendAdapter(enabled: boolean): DefaultIntakeAdapter {
  return {
    mode: "backend",
    enabled,

    // Fixture-id guard is still useful defensively — even in backend mode
    // no fixture id should ever cross a server boundary.
    isFixtureId(value) {
      return typeof value === "string" && value.startsWith("fixture-default-intake-");
    },
    assertNoFixtureIds(values) {
      for (const v of values) {
        if (typeof v === "string" && v.startsWith("fixture-default-intake-")) {
          throw new Error(
            "Default Intake preview fixture IDs must not be sent to server functions.",
          );
        }
      }
    },

    getConfiguration(): DefaultIntakeConfiguration | null {
      return notImplemented("getConfiguration");
    },
    listQueue(): DefaultIntakeQueueRecord[] {
      return notImplemented("listQueue");
    },
    async reassign(_input: ReassignInput): Promise<void> {
      notImplemented("reassign");
    },
    async bulkReassign(_input: BulkReassignInput): Promise<void> {
      notImplemented("bulkReassign");
    },
    subscribe(_listener: () => void): () => void {
      return () => {};
    },
  };
}
