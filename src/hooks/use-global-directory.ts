import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useHasSession } from "@/hooks/use-has-session";
import { gateway } from "@/lib/api-gateway/client";
import {
  listGlobalStartups,
  listGlobalInvestors,
  listGlobalDeals,
  listImportTargets,
} from "@/lib/global-directory.functions";

// We funnel reads through `useServerFn` so the auth header attaches,
// but the gateway client remains the conceptual seam.
void gateway;

export function useGlobalStartups() {
  const fn = useServerFn(listGlobalStartups);
  const enabled = useHasSession();
  return useQuery({ queryKey: ["global", "startups"], queryFn: () => fn(), enabled });
}

export function useGlobalInvestors() {
  const fn = useServerFn(listGlobalInvestors);
  const enabled = useHasSession();
  return useQuery({ queryKey: ["global", "investors"], queryFn: () => fn(), enabled });
}

export function useGlobalDeals() {
  const fn = useServerFn(listGlobalDeals);
  const enabled = useHasSession();
  return useQuery({ queryKey: ["global", "deals"], queryFn: () => fn(), enabled });
}

export function useImportTargets() {
  const fn = useServerFn(listImportTargets);
  const enabled = useHasSession();
  return useQuery({ queryKey: ["global", "import-targets"], queryFn: () => fn(), enabled });
}
