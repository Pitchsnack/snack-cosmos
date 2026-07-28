import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  publicationAdapter,
  isPublicationPreview,
  subscribePreviewPublications,
  readPreviewPublication,
  type DirectoryProjection,
  type PublicationStatus,
  type StartupPublication,
} from "@/lib/publication";

/**
 * Re-renders whenever session-scoped preview publication state changes.
 * Returns a monotonic version token; preview-only, never persistent.
 */
export function usePreviewPublicationVersion(): number {
  return useSyncExternalStore(
    (cb) => (isPublicationPreview ? subscribePreviewPublications(cb) : () => {}),
    () => previewVersion,
    () => 0,
  );
}

let previewVersion = 0;
if (isPublicationPreview) {
  subscribePreviewPublications(() => {
    previewVersion += 1;
  });
}

/** Preview-only directory visibility check. */
export function isPreviewPublished(startupRef: string): boolean {
  return isPublicationPreview && readPreviewPublication(startupRef).status === "published";
}


export interface UsePublicationResult {
  status: PublicationStatus;
  publication: StartupPublication | null;
  canMutate: boolean;
  previewNotice: string | null;
  isPending: boolean;
  error: string | null;
  unavailableReason: string | null;
  publish: (projection: DirectoryProjection, tenantRef: string | null) => Promise<boolean>;
  unpublish: () => Promise<boolean>;
  clearError: () => void;
}

export function usePublication(startupRef: string | undefined): UsePublicationResult {
  const [publication, setPublication] = useState<StartupPublication | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!startupRef) return;
    const res = await publicationAdapter.getStatus(startupRef);
    if (res.kind === "ok") {
      setPublication(res.data);
      setUnavailableReason(null);
    } else if (res.kind === "capability_unavailable") {
      setPublication(null);
      setUnavailableReason(res.reason);
    }
  }, [startupRef]);

  useEffect(() => {
    void load();
    if (!isPublicationPreview) return;
    const unsub = subscribePreviewPublications(() => void load());
    return () => {
      unsub();
    };
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<ReturnType<typeof publicationAdapter.publish> extends Promise<infer R> ? R : never>) => {
      if (isPending) return false; // prevents duplicate requests
      setPending(true);
      setError(null);
      const previous = publication;
      const res = await fn();
      setPending(false);
      if (res.kind === "ok") {
        setPublication(res.data);
        return true;
      }
      // Roll back the visual state; the founder-owned startup is untouched.
      setPublication(previous);
      if (res.kind === "capability_unavailable") setUnavailableReason(res.reason);
      setError(
        "We could not update the directory publication. Your startup remains unchanged.",
      );
      return false;
    },
    [isPending, publication],
  );

  const publish = useCallback(
    (projection: DirectoryProjection, tenantRef: string | null) => {
      if (!startupRef) return Promise.resolve(false);
      return run(() => publicationAdapter.publish(startupRef, projection, tenantRef));
    },
    [run, startupRef],
  );

  const unpublish = useCallback(() => {
    if (!startupRef) return Promise.resolve(false);
    return run(() => publicationAdapter.unpublish(startupRef));
  }, [run, startupRef]);

  return {
    status: publication?.status ?? "private",
    publication,
    canMutate: publicationAdapter.canMutate,
    previewNotice: publicationAdapter.previewNotice,
    isPending,
    error,
    unavailableReason,
    publish,
    unpublish,
    clearError: () => setError(null),
  };
}
