import { describe, expect, test } from "bun:test";
import { requireHelpAdmin, helpSummaries } from "../../src/lib/admin-help.server";

function chain(result: any) {
  const c: any = {};
  for (const key of ["select", "eq", "in", "like", "order", "range", "limit", "maybeSingle"]) c[key] = () => c;
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return c;
}
describe("Control Help desk security", () => {
  test("requires both Control role and Admin account", async () => {
    for (const [control, role] of [[true, "buyer"], [false, "admin"], [false, "seller"]]) {
      await expect(requireHelpAdmin({ userId: "me", supabase: { rpc: () => chain({ data: control }), from: () => chain({ data: { account_role: role } }) } })).rejects.toThrow("Forbidden");
    }
    await expect(requireHelpAdmin({ userId: "me", supabase: { rpc: () => chain({ data: true }), from: () => chain({ data: { account_role: "admin" } }) } })).resolves.toBeUndefined();
  });
  test("an admin read clears shared unread for another admin", async () => {
    const thread = "a:buyer";
    const messages = [{ thread_key: thread, sender_id: "buyer", body: "Question", created_at: "2026-10-15T01:00:00Z", files: [] }];
    let read = false;
    const sb: any = { from: (table: string) => {
      if (table === "marketplace_messages") return chain({ data: messages });
      if (table === "user_roles") return chain({ data: [{ user_id: "admin1" }, { user_id: "admin2" }] });
      if (table === "marketplace_message_reads") return chain({ data: read ? [{ thread_key: thread, read_at: "2026-10-15T01:01:00Z" }] : [] });
      if (table === "users") {
        const c = chain({ data: [{ id: "admin1", first_name: "One" }, { id: "admin2", first_name: "Two" }] });
        c.maybeSingle = () => chain({ data: { id: "buyer", first_name: "Buyer", email: "buyer@example.test", account_role: "buyer", created_at: "2026-10-01" } });
        return c;
      }
      return chain({ data: table === "buyer_profiles" ? [] : null });
    } };
    expect((await helpSummaries(sb, "admin2"))[0]?.unread).toBe(1);
    read = true;
    expect((await helpSummaries(sb, "admin2"))[0]?.unread).toBe(0);
  });
});