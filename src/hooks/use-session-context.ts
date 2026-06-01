import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSessionContext, type SessionContextDTO } from "@/lib/session-context.functions";
import type { Permission } from "@/lib/permissions";
import { useHasSession } from "@/hooks/use-has-session";

export function useSessionContext() {
  const fn = useServerFn(getSessionContext);
  const enabled = useHasSession();
  return useQuery<SessionContextDTO>({
    queryKey: ["session-context"],
    queryFn: () => fn(),
    staleTime: 60_000,
    enabled,
  });
}

export function usePermissions() {
  const { data } = useSessionContext();
  const perms = new Set<Permission>(data?.permissions ?? []);
  return {
    has: (p: Permission) => perms.has(p),
    hasAny: (ps: Permission[]) => ps.some((p) => perms.has(p)),
    isControl: (data?.roles ?? []).includes("CONTROL"),
    roles: data?.roles ?? [],
  };
}
