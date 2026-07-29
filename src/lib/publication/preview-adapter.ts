/**
 * Preview adapter — NON-PERSISTENT DEMONSTRATION BEHAVIOUR.
 *
 * Must be explicitly enabled with VITE_PUBLICATION_MODE=preview. It is never
 * the default and is force-disabled in production builds.
 *
 * Guarantees:
 *  - in-memory only, session-scoped, lost on reload
 *  - no Supabase access, no server functions, no persistence of any kind
 *  - not cross-user, not Control-DB backed
 *  - never authoritative for the real Startup Directory
 */
import type {
  PublicationAdapter,
  PublicationOutcome,
  StartupPublication,
  StartupRef,
} from "./types";

/** Required, user-visible disclosure for preview-mode publication. */
export const PREVIEW_DISCLAIMER =
  "Preview mode: publication changes are temporary and apply only to this session. Persistent publication will be enabled after the backend publication service is connected.";

const store = new Map<StartupRef, StartupPublication>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(startupRef: StartupRef): StartupPublication {
  return (
    store.get(startupRef) ?? {
      startup_ref: startupRef,
      tenant_ref: null,
      publication_ref: null,
      status: "private",
      updated_at: null,
    }
  );
}

function delay(ms = 450) {
  return new Promise((r) => setTimeout(r, ms));
}

export function subscribePreviewPublications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readPreviewPublication(startupRef: StartupRef): StartupPublication {
  return read(startupRef);
}

export const previewPublicationAdapter: PublicationAdapter = {
  mode: "preview",
  canMutate: true,
  previewNotice: PREVIEW_DISCLAIMER,

  async getStatus(startupRef) {
    return { kind: "ok", data: read(startupRef) };
  },

  async publish(startupRef, projection, tenantRef) {
    await delay();
    // Only the allowlisted projection is ever handled here.
    void projection;
    const next: StartupPublication = {
      startup_ref: startupRef,
      tenant_ref: tenantRef,
      // Logical, non-physical demonstration reference.
      publication_ref: `preview-pub-${startupRef}`,
      status: "published",
      updated_at: new Date().toISOString(),
    };
    store.set(startupRef, next);
    emit();
    return { kind: "ok", data: next };
  },

  async unpublish(startupRef) {
    await delay();
    const current = read(startupRef);
    const next: StartupPublication = {
      ...current,
      publication_ref: null,
      status: "unpublished",
      updated_at: new Date().toISOString(),
    };
    store.set(startupRef, next);
    emit();
    return { kind: "ok", data: next };
  },
};

/**
 * Session-scoped list of preview-published startup refs.
 * Preview-only. Never persistent, never cross-user, never authoritative.
 */
export function listPreviewPublishedRefs(): string[] {
  return [...store.values()]
    .filter((p) => p.status === "published")
    .map((p) => p.startup_ref);
}
