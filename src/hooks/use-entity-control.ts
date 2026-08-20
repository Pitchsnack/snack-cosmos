import { useSyncExternalStore } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteControlRecords,
  listControlFacets,
  listControlInvestors,
  listControlStartups,
  setControlDirectoryState,
} from "@/lib/entity-control/entity-control.functions";

import {
  decideDrafts,
  deleteDrafts,
  draftSummary,
  draftsVersion,
  listDrafts,
  subscribeDrafts,
} from "@/lib/entity-control/drafts-adapter";

import type {
  ControlListParams,
  DirectoryState,
  DraftListParams,
  DraftReviewStatus,
} from "@/lib/entity-control/types";

export function useControlStartups(params: ControlListParams) {
  const fn = useServerFn(listControlStartups);
  return useQuery({
    queryKey: ["entity-control", "startups", params],
    queryFn: () => fn({ data: params }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useControlInvestors(params: ControlListParams) {
  const fn = useServerFn(listControlInvestors);
  return useQuery({
    queryKey: ["entity-control", "investors", params],
    queryFn: () => fn({ data: params }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useControlFacets() {
  const fn = useServerFn(listControlFacets);
  return useQuery({
    queryKey: ["entity-control", "facets"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
}

export function useSetDirectoryState() {
  const fn = useServerFn(setControlDirectoryState);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { entity: "startup" | "investor"; ids: string[]; state: DirectoryState }) =>
      fn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entity-control"] }),
  });
}

/* --------------------------- AI Draft Extraction -------------------------- */

function useDraftsVersion() {
  return useSyncExternalStore(subscribeDrafts, draftsVersion, () => 0);
}

export function useDrafts(params: DraftListParams) {
  useDraftsVersion();
  return listDrafts(params);
}

export function useDraftSummary(kind: DraftListParams["kind"]) {
  useDraftsVersion();
  return draftSummary(kind);
}

export function useDecideDrafts() {
  return (refs: string[], status: DraftReviewStatus) => decideDrafts(refs, status);
}
