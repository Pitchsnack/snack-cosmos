import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStartups } from "@/lib/startups.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useStartups() {
  const fn = useServerFn(listStartups);
  const enabled = useHasSession();
  return useQuery({
    queryKey: ["startups", "list"],
    queryFn: () => fn(),
    enabled,
  });
}
