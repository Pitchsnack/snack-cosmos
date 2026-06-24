import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGlobalStartup,
  listImportsOfGlobalStartup,
} from "@/lib/api-gateway/global-startups";
import { useHasSession } from "@/hooks/use-has-session";

export function useGlobalStartup(globalId: string | undefined) {
  const fn = useServerFn(getGlobalStartup);
  const enabled = useHasSession() && !!globalId;
  return useQuery({
    queryKey: ["global-startup", globalId],
    queryFn: () => fn({ data: { globalId: globalId! } }),
    enabled,
  });
}

export function useGlobalStartupImports(globalId: string | undefined) {
  const fn = useServerFn(listImportsOfGlobalStartup);
  const enabled = useHasSession() && !!globalId;
  return useQuery({
    queryKey: ["global-startup-imports", globalId],
    queryFn: () => fn({ data: { globalId: globalId! } }),
    enabled,
  });
}
