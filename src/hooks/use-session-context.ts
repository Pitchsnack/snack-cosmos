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
  const { data, isLoading, isFetching, isSuccess, isError } = useSessionContext();
  const perms = new Set<Permission>(data?.permissions ?? []);
  // "Resolved" means we have an authoritative answer (success or error).
  // Until then, callers must treat permissions as Loading, not Denied.
  const isResolved = isSuccess || isError;
  return {
    has: (p: Permission) => perms.has(p),
    hasAny: (ps: Permission[]) => ps.some((p) => perms.has(p)),
    isControl: (data?.roles ?? []).includes("CONTROL"),
    roles: data?.roles ?? [],
    isLoading: !isResolved || isLoading,
    isFetching,
    isResolved,
  };
}
