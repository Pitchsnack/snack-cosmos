import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvestor, getInvestorActivity, getInvestorAuditLogs } from "@/lib/investors.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useInvestor(id: string | undefined) {
  const fn = useServerFn(getInvestor);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["investor", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled,
  });
}

export function useInvestorActivity(id: string | undefined) {
  const fn = useServerFn(getInvestorActivity);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["investor-activity", id],
    queryFn: () => fn({ data: { investorId: id! } }),
    enabled,
  });
}

export function useInvestorAuditLogs(id: string | undefined) {
  const fn = useServerFn(getInvestorAuditLogs);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["investor-audit", id],
    queryFn: () => fn({ data: { investorId: id! } }),
    enabled,
  });
}
