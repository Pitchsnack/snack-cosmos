/**
 * Default adapter. Publication is switched OFF.
 *
 * Reports every startup as private and refuses every mutation with an explicit
 * capability-unavailable outcome. This is the production default: a production
 * build must never silently fall back to preview behaviour.
 */
import type {
  PublicationAdapter,
  PublicationOutcome,
  StartupPublication,
  StartupRef,
} from "./types";

const REASON =
  "Directory publication is disabled in this environment. No approved publication backend is configured.";

function unavailable<T>(): PublicationOutcome<T> {
  return { kind: "capability_unavailable", reason: REASON };
}

export const disabledPublicationAdapter: PublicationAdapter = {
  mode: "disabled",
  canMutate: false,
  previewNotice: null,

  async getStatus(startupRef: StartupRef): Promise<PublicationOutcome<StartupPublication>> {
    return {
      kind: "ok",
      data: {
        startup_ref: startupRef,
        tenant_ref: null,
        publication_ref: null,
        status: "private",
        updated_at: null,
      },
    };
  },

  async publish() {
    return unavailable<StartupPublication>();
  },

  async unpublish() {
    return unavailable<StartupPublication>();
  },
};
