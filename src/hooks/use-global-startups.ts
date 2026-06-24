import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGlobalStartups } from "@/lib/api-gateway/global-startups";
import { useHasSession } from "@/hooks/use-has-session";

export interface UseGlobalStartupsParams {
  search?: string;
  sector?: string;
  stage?: string;
  status?: "draft" | "available" | "recommended" | "archived";
  tag?: string;
  publishedOnly?: boolean;
  sort?: "updated_desc" | "created_desc" | "name_asc";
}

export function useGlobalStartups(params: UseGlobalStartupsParams = {}) {
  const fn = useServerFn(listGlobalStartups);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["global-startups", "list", params],
    queryFn: () => fn({ data: params }),
    enabled,
    staleTime: 60_000,
  });
}
