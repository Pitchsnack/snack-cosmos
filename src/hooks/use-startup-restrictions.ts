import { useCallback, useEffect, useState } from "react";

import {
  isAuthorizedViewer,
  loadRestrictions,
  maskRestricted,
  subscribeToRestrictions,
  type RestrictableOwnership,
  type RestrictionMap,
  type RestrictionsScope,
} from "@/lib/restrictions/startup-restrictions";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";

/** Bumps whenever any restriction map changes, so views re-render on Save. */
function useRestrictionsVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeToRestrictions(() => setVersion((v) => v + 1)), []);
  return version;
}

/** Restriction map for a single startup within a module scope. */
export function useStartupRestrictions(scope: RestrictionsScope, id: string | undefined) {
  const version = useRestrictionsVersion();
  const [map, setMap] = useState<RestrictionMap>({});
  useEffect(() => {
    setMap(id ? loadRestrictions(scope, id) : {});
  }, [scope, id, version]);
  return map;
}

/**
 * Returns a mask() helper applying the saved Basic Information Restrictions to
 * any startup-shaped record for the current viewer. Authorized users (founder /
 * owner / CONTROL) get untouched data.
 */
export function useRestrictionMask(scope: RestrictionsScope) {
  const version = useRestrictionsVersion();
  const { isControl } = usePermissions();
  const { data: session } = useSessionContext();
  const viewerId = session?.user?.id ?? null;

  const mask = useCallback(
    <T extends RestrictableOwnership & Record<string, unknown>>(item: T) => {
      if (isAuthorizedViewer(item, viewerId, isControl)) {
        return { ...item, restricted_fields: [] as string[] };
      }
      return maskRestricted(item, loadRestrictions(scope, item.id));
    },
    // version participates so masking recomputes after a Save
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, viewerId, isControl, version],
  );

  return { mask, version };
}
