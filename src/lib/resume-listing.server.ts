/** Only an RLS-visible listing's last approved snapshot can be restored. */
export async function restoreApprovedListing(
  sb: any,
  listingId: string,
  userId: string,
  getAdmin: () => Promise<any>,
  log: (event: Record<string, unknown>) => Promise<void>,
) {
  const { data: p, error: readError } = await sb.from("hidden_profiles")
    .select("id, startup_id, tenant_id, version, approval_status, live_snapshot")
    .eq("id", listingId).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!p) throw new Error("Listing not found");
  if (p.approval_status === "live") return { ok: true, alreadyLive: true };
  if (p.approval_status !== "unpublished" || !p.live_snapshot)
    throw new Error("This listing can't go live again from here. Register your company instead.");
  const pub = p.live_snapshot.public ?? {};
  const sbAdmin = await getAdmin();
  const { data: changed, error } = await sbAdmin.from("hidden_profiles").update({
    status: "live", approval_status: "live", live: pub, unpublished_at: null, updated_by: userId,
  }).eq("id", p.id).eq("approval_status", "unpublished").select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!changed) {
    // A simultaneous resume may already have completed. Do not log it twice.
    const { data: current, error: currentError } = await sb.from("hidden_profiles")
      .select("approval_status").eq("id", listingId).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (current?.approval_status === "live") return { ok: true, alreadyLive: true };
    throw new Error("Listing status changed. Reload and try again.");
  }
  const { error: visibilityError } = await sbAdmin.from("startups").update({ visibility: "Tenant" })
    .eq("id", p.startup_id).eq("visibility", "Private");
  if (visibilityError) throw new Error(visibilityError.message);
  await log({ item_type: "listing", item_id: p.id, startup_id: p.startup_id,
    subject_user_id: userId, version: p.version, action: "publish", actor_id: userId });
  return { ok: true, alreadyLive: false };
}