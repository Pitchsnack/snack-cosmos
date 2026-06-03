import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedDeal, listShareActivity } from "@/lib/deal-shares.functions";
import { listIntroductions } from "@/lib/deal-introductions.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useSharedDeal(shareId: string | undefined) {
  const fn = useServerFn(getSharedDeal);
  const enabled = useHasSession() && !!shareId;
  return useQuery({
    queryKey: ["shared-deal", shareId],
    queryFn: () => fn({ data: { shareId: shareId! } }),
    enabled,
  });
}

export function useShareActivity(shareId: string | undefined) {
  const fn = useServerFn(listShareActivity);
  const enabled = useHasSession() && !!shareId;
  return useQuery({
    queryKey: ["shared-deal-activity", shareId],
    queryFn: () => fn({ data: { shareId: shareId! } }),
    enabled,
  });
}

export function useDealIntroductions(dealId: string | undefined) {
  const fn = useServerFn(listIntroductions);
  const enabled = useHasSession() && !!dealId;
  return useQuery({
    queryKey: ["deal-introductions", dealId],
    queryFn: () => fn({ data: { dealId: dealId! } }),
    enabled,
  });
}
