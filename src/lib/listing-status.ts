import type { QueryClient } from "@tanstack/react-query";

/** Refresh the owner views that derive their state from approval changes. */
export async function refreshListingStatus(client: QueryClient) {
  await Promise.all([
    ["startups"], ["hidden-profiles"], ["hidden-profile-facts"],
    ["approval-notice"],
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
}