import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createHiddenProfile,
  discardHiddenChanges,
  getHiddenProfileFacts,
  listHiddenProfiles,
  publishHiddenProfile,
  saveHiddenProfile,
  unpublishHiddenProfile,
} from "@/lib/hidden-profiles.functions";
import type { HiddenDraft, HiddenProfileRow } from "@/lib/hidden-profile";
import { useHasSession } from "@/hooks/use-has-session";

const KEY = ["hidden-profiles"] as const;

export function useHiddenProfiles() {
  const fn = useServerFn(listHiddenProfiles);
  const enabled = useHasSession();
  const q = useQuery({ queryKey: KEY, queryFn: () => fn(), enabled, staleTime: 30_000 });
  const byStartup = useMemo(() => {
    const m = new Map<string, HiddenProfileRow>();
    for (const r of q.data ?? []) m.set(r.startup_id, r);
    return m;
  }, [q.data]);
  return { ...q, byStartup };
}

export function useHiddenProfile(startupId: string | undefined) {
  const { byStartup, isLoading } = useHiddenProfiles();
  return { row: startupId ? byStartup.get(startupId) ?? null : null, isLoading };
}

export function useEntryFacts(startupId: string | undefined) {
  const fn = useServerFn(getHiddenProfileFacts);
  const enabled = useHasSession() && !!startupId;
  return useQuery({
    queryKey: ["hidden-profile-facts", startupId],
    queryFn: () => fn({ data: { startupId: startupId! } }),
    enabled,
  });
}

function useWrite<I>(fnRef: (a: { data: I }) => Promise<HiddenProfileRow>, ok?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: I) => fnRef({ data }),
    onSuccess: (row) => {
      qc.setQueryData<HiddenProfileRow[]>(KEY, (prev) => {
        const list = (prev ?? []).filter((r) => r.startup_id !== row.startup_id);
        return [...list, row];
      });
      qc.invalidateQueries({ queryKey: ["marketplace-teasers"] });
      if (ok) toast.success(ok);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

export function useHiddenProfileActions() {
  const create = useServerFn(createHiddenProfile);
  const save = useServerFn(saveHiddenProfile);
  const publish = useServerFn(publishHiddenProfile);
  const unpublish = useServerFn(unpublishHiddenProfile);
  const discard = useServerFn(discardHiddenChanges);
  return {
    create: useWrite<{ startupId: string }>(create, "Hidden profile draft created"),
    save: useWrite<{ startupId: string; draft: HiddenDraft }>(save, "Draft saved"),
    publish: useWrite<{ startupId: string; draft: HiddenDraft }>(publish, "Live in SME Takeover"),
    unpublish: useWrite<{ startupId: string }>(unpublish, "Unpublished — back to draft"),
    discard: useWrite<{ startupId: string }>(discard, "Changes discarded"),
  };
}
