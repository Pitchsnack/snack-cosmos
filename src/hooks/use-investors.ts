import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvestors } from "@/lib/investors.functions";
import { useHasSession } from "@/hooks/use-has-session";

export interface UseInvestorsParams {
  search?: string;
  type?: string;
  country?: string;
}

export function useInvestors(params: UseInvestorsParams = {}) {
  const fn = useServerFn(listInvestors);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["investors", "list", params],
    queryFn: () => fn({ data: params }),
    enabled,
    staleTime: 60_000,
  });
}
