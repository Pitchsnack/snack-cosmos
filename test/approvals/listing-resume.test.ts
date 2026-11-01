import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { refreshListingStatus } from "../../src/lib/listing-status";
import { restoreApprovedListing } from "../../src/lib/resume-listing.server";

const approved = { id: "listing", startup_id: "company", version: 2, approval_status: "unpublished", live_snapshot: { public: { headline: "Approved" } } };
function setup(row: any = approved, changed: any = { id: "listing" }, current = "live") {
  let reads = 0;
  const read: any = { select: () => read, eq: () => read, maybeSingle: async () => ({ data: reads++ === 0 ? row : { approval_status: current } }) };
  const writes: any[] = [];
  const privileged = { from: (table: string) => {
    const chain: any = { update: (value: any) => { writes.push({ table, value }); return chain; }, eq: () => chain,
      select: () => chain, maybeSingle: async () => ({ data: changed }), then: (resolve: any) => resolve({ error: null }) };
    return chain;
  } };
  const getAdmin = vi.fn(async () => privileged);
  const log = vi.fn(async () => {});
  return { sb: { from: () => read }, getAdmin, log, writes };
}
describe("seller listing resume", () => {
  it("refreshes the actual owner queries and waits for refresh completion", async () => {
    const client = new QueryClient();
    const keys: unknown[] = [];
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(client, "invalidateQueries").mockImplementation((filters) => { keys.push(filters?.queryKey); return pending; });
    let finished = false;
    const refreshing = refreshListingStatus(client).then(() => { finished = true; });
    expect(keys).toEqual([["startups"], ["hidden-profiles"], ["hidden-profile-facts"], ["approval-notice"]]);
    await Promise.resolve();
    expect(finished).toBe(false);
    release?.();
    await refreshing;
    expect(finished).toBe(true);
  });
  it("restores the approved snapshot and logs one publish", async () => {
    const x = setup();
    expect(await restoreApprovedListing(x.sb, "listing", "seller", x.getAdmin, x.log)).toEqual({ ok: true, alreadyLive: false });
    expect(x.writes[0].value).toEqual({ status: "live", approval_status: "live", live: { headline: "Approved" }, unpublished_at: null, updated_by: "seller" });
    expect(x.log).toHaveBeenCalledTimes(1);
    expect(x.writes[1]).toEqual({ table: "startups", value: { visibility: "Tenant" } });
  });
  it("an already-live listing succeeds without writes or extra events", async () => {
    const x = setup({ ...approved, approval_status: "live" });
    expect(await restoreApprovedListing(x.sb, "listing", "seller", x.getAdmin, x.log)).toEqual({ ok: true, alreadyLive: true });
    expect(x.getAdmin).not.toHaveBeenCalled();
    expect(x.log).not.toHaveBeenCalled();
  });
  it("a concurrent resume does not log a second publish", async () => {
    const x = setup(approved, null);
    expect(await restoreApprovedListing(x.sb, "listing", "seller", x.getAdmin, x.log)).toEqual({ ok: true, alreadyLive: true });
    expect(x.log).not.toHaveBeenCalled();
    expect(x.writes).toHaveLength(1);
  });
  it("denies a listing hidden by RLS before loading the privileged client", async () => {
    const x = setup(null);
    await expect(restoreApprovedListing(x.sb, "listing", "seller", x.getAdmin, x.log)).rejects.toThrow("Listing not found");
    expect(x.getAdmin).not.toHaveBeenCalled();
  });
  it.each([{ ...approved, live_snapshot: null }, { ...approved, approval_status: "draft" }])("never publishes an unapproved listing", async (row) => {
    const x = setup(row);
    await expect(restoreApprovedListing(x.sb, "listing", "seller", x.getAdmin, x.log)).rejects.toThrow("Register your company instead");
    expect(x.getAdmin).not.toHaveBeenCalled();
  });
});