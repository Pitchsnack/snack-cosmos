import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStartupFinancials } from "@/lib/financials.functions";

/**
 * Presentation helper: does this startup already have extracted financial data?
 * Used to colour-code the Financials action.
 */
export function useHasFinancials(id: string) {
  const fetchFinancials = useServerFn(getStartupFinancials);
  const { data, isLoading } = useQuery({
    queryKey: ["startup-financials", id],
    queryFn: () => fetchFinancials({ data: { startupId: id } }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return { hasData: (data?.years?.length ?? 0) > 0, isLoading };
}
