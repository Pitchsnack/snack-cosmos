/**
 * Page-level loading indicator.
 *
 * Shows the PitchSnack hat while either
 *  - the router is still loading the page the user clicked in the menu, or
 *  - that page is waiting for its first batch of data (queries with no
 *    cached result yet).
 *
 * Background refreshes of data already on screen are ignored, so badges that
 * poll every few seconds never make the indicator blink.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HatMark } from "@/components/ui/PitchSnackLoader";

function useFirstLoadCount() {
  const qc = useQueryClient();
  const cache = qc.getQueryCache();
  return useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () =>
      cache
        .getAll()
        .filter((q) => q.state.status === "pending" && q.state.fetchStatus === "fetching" && q.getObserversCount() > 0)
        .length,
    () => 0,
  );
}

export function GlobalRouteLoading({ delay = 180 }: { delay?: number }) {
  const routerLoading = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const firstLoads = useFirstLoadCount();
  const busy = routerLoading || firstLoads > 0;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [busy, delay]);

  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[54px] bottom-0 z-30 flex items-start justify-center bg-background/55 pt-[18vh] backdrop-blur-[1px]"
    >
      <div className="pointer-events-none flex flex-col items-center gap-3">
        <HatMark size="lg" />
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      </div>
      <span className="ps-sr">Loading</span>
    </div>
  );
}
