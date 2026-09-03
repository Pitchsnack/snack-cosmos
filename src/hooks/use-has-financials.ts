import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStartupFinancials } from "@/lib/financials.functions";

export const financialsQueryKey = (id: string) => ["startup-financials", id] as const;

/** Keep the fetched statements warm so the Financials page can render instantly. */
export const FINANCIALS_STALE_TIME = 5 * 60_000;

/**
 * Presentation helper: does this startup already have extracted financial data?
 * Used to colour-code the Financials action.
 */
export function useHasFinancials(id: string) {
  const fetchFinancials = useServerFn(getStartupFinancials);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: financialsQueryKey(id),
    queryFn: () => fetchFinancials({ data: { startupId: id } }),
    enabled: Boolean(id),
    staleTime: FINANCIALS_STALE_TIME,
    gcTime: 10 * 60_000,
  });

  /** Warm the cache before navigation so the page has no loading gap. */
  const prefetch = () => {
    if (!id) return;
    void queryClient.prefetchQuery({
      queryKey: financialsQueryKey(id),
      queryFn: () => fetchFinancials({ data: { startupId: id } }),
      staleTime: FINANCIALS_STALE_TIME,
    });
  };

  return { hasData: (data?.years?.length ?? 0) > 0, isLoading, prefetch };
}
