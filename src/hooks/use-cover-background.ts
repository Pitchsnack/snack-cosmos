import { useCallback, useSyncExternalStore } from "react";
import {
  getCoverBackground,
  setCoverBackground,
  subscribeCoverBackground,
  type CoverBackgroundId,
} from "@/lib/cover/cover-background";

/** Reactive read/write of the fixed cover background chosen for a startup. */
export function useCoverBackground(startupRef: string) {
  const selected = useSyncExternalStore(
    subscribeCoverBackground,
    () => getCoverBackground(startupRef),
    () => null,
  );

  const select = useCallback(
    (id: CoverBackgroundId) => setCoverBackground(startupRef, id),
    [startupRef],
  );

  return { selected, select };
}
