import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStartup, getStartupActivity, getStartupAuditLogs } from "@/lib/startups.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useStartup(id: string | undefined) {
  const fn = useServerFn(getStartup);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["startup", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled,
  });
}

export function useStartupActivity(id: string | undefined) {
  const fn = useServerFn(getStartupActivity);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["startup-activity", id],
    queryFn: () => fn({ data: { startupId: id! } }),
    enabled,
  });
}

export function useStartupAuditLogs(id: string | undefined) {
  const fn = useServerFn(getStartupAuditLogs);
  const enabled = useHasSession() && !!id;
  return useQuery({
    queryKey: ["startup-audit", id],
    queryFn: () => fn({ data: { startupId: id! } }),
    enabled,
  });
}
