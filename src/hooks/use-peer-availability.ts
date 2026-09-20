import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getPeerAvailability } from "@/lib/peer-comparables.functions";
import type { PeerAvailability } from "@/lib/peer-comparables";

/** Live peer-set coverage, used to badge the business model picker. */
export function usePeerAvailability(enabled = true) {
  const fn = useServerFn(getPeerAvailability);
  return useQuery<PeerAvailability>({
    queryKey: ["peer-availability"],
    queryFn: () => fn(),
    enabled,
    staleTime: 60_000,
  });
}
