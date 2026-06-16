import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSharedDeals } from "@/lib/deal-shares.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useSharedDeals() {
  const fn = useServerFn(listSharedDeals);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["shared-deals", "list"],
    queryFn: () => fn(),
    enabled,
    staleTime: 60_000,
  });
}
