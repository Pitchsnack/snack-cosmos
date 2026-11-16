import { IDENTITY_COLUMNS, IDENTITY_LOCKED_MESSAGE, lockedIdentityChanges, type IdentityTable } from "./identity-lock";

/**
 * For saves that run with the privileged client (the database trigger can't see the caller there).
 * Non-Admin: locked changes are removed from `patch` so the other fields still save; call `finish()` after the
 * update — it throws the locked message when something was blocked. Admin (Control): changes go through and
 * `finish()` records them in audit_logs.
 */
export async function guardLockedIdentity(sb: any, table: IdentityTable, id: string, patch: Record<string, unknown>, userId: string, privileged = true) {
  const { data: stored } = await sb.from(table).select(["reg_locked_at", "tenant_id", ...IDENTITY_COLUMNS[table]].filter((c) => !(table === "advisor_firms" && c === "tenant_id")).join(", ")).eq("id", id).maybeSingle();
  const changed = stored ? lockedIdentityChanges(table, stored, patch) : [];
  let admin = false;
  if (changed.length) {
    const { data } = await sb.rpc("is_control", { _user_id: userId });
    admin = !!data;
    if (!admin) for (const c of changed) delete patch[c];
  }
  return {
    blocked: changed.length > 0 && !admin,
    async finish() {
      if (!changed.length) return;
      if (!admin) throw new Error(IDENTITY_LOCKED_MESSAGE);
      // As the signed-in user, the database's audit trigger records Admin's change itself.
      if (!privileged) return;
      await sb.from("audit_logs").insert({
        tenant_id: stored.tenant_id ?? null, entity_type: table, entity_id: id, action: "locked_identity_changed", performed_by: userId,
        old_value: Object.fromEntries(changed.map((c) => [c, stored[c] ?? null])), new_value: Object.fromEntries(changed.map((c) => [c, patch[c] ?? null])),
      });
    },
  };
}
