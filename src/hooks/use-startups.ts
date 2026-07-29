import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStartups } from "@/lib/startups.functions";
import { useHasSession } from "@/hooks/use-has-session";

export interface UseStartupsParams {
  search?: string;
  stage?: string;
  industry?: string;
  headquarters?: string;
  companyType?: string;
  productTag?: string;
  marketTag?: string;
  sort?: "updated_desc" | "created_desc" | "name_asc" | "name_desc";
  page?: number;
  pageSize?: number;
  /** "directory" excludes Private founder-owned records at query level. */
  scope?: "workspace" | "directory";
  /** Preview-only, session-scoped refs allowed into the preview Directory. */
  allowPrivateRefs?: string[];
}

export function useStartups(params: UseStartupsParams = {}) {
  const fn = useServerFn(listStartups);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["startups", "list", params],
    queryFn: () => fn({ data: params }),
    enabled,
    staleTime: 60_000,
  });
}
