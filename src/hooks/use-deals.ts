import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDeals } from "@/lib/deals.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useDeals() {
  const fn = useServerFn(listDeals);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["deals", "list"],
    queryFn: () => fn(),
    enabled,
  });
}
