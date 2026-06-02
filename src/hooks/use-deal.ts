import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDeal, getDealActivity, getDealAuditLogs } from "@/lib/deals.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useDeal(id: string | undefined) {
  const fn = useServerFn(getDeal);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["deal", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled,
  });
}

export function useDealActivity(id: string | undefined) {
  const fn = useServerFn(getDealActivity);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["deal-activity", id],
    queryFn: () => fn({ data: { dealId: id! } }),
    enabled,
  });
}

export function useDealAuditLogs(id: string | undefined) {
  const fn = useServerFn(getDealAuditLogs);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["deal-audit", id],
    queryFn: () => fn({ data: { dealId: id! } }),
    enabled,
  });
}
