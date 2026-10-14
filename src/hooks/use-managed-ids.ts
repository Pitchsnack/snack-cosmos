import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myManagedIds } from "@/lib/managed.functions";

/** My Company: ids (of the given ones) that are Managed by PitchSnack. */
export function useManagedIds(kind: "startup" | "investor" | "firm", ids: (string | null | undefined)[]) {
  const fn = useServerFn(myManagedIds);
  const list = [...new Set(ids.filter(Boolean) as string[])].sort();
  const { data } = useQuery({
    queryKey: ["managed-ids", kind, list],
    queryFn: () => fn({ data: { kind, ids: list } }),
    enabled: list.length > 0,
    staleTime: 60_000,
  });
  return new Set(data ?? []);
}
