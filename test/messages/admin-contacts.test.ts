import { describe, expect, test } from "bun:test";
import { CONTACT_ROLES, filterAdminContacts, contactProfileStatus, contactActiveAge, activeContactNda, type AdminContact } from "../../src/lib/admin-contacts";
import { contactRows, loadAdminContacts } from "../../src/lib/admin-contacts.server";
import { requireHelpAdmin } from "../../src/lib/admin-help.server";

const row = (id: string, role: AdminContact["role"]): AdminContact => ({ id, role, name: id, email: `${id}@example.test`, title: null, phone: null, linkedin: null, location: null, website: null, status: "Active", joined: "2026-10-27", lastActive: null, connections: 0, organisations: [{ id: "org", kind: role, name: "Company", ref: "PS-1234", status: "draft" }] });
describe("Admin contacts", () => {
  test("includes buyers, sellers and advisors without publication filtering", () => {
    expect(CONTACT_ROLES).toEqual(["buyer", "seller", "advisor"]);
    expect(filterAdminContacts([row("B", "buyer"), row("S", "seller"), row("A", "advisor")], "all", "all", "", "name").length).toBe(3);
  });
  test("role filters select the requested account role", () => {
    expect(filterAdminContacts([row("B", "buyer"), row("S", "seller")], "buyer", "all", "", "name").map(c => c.id)).toEqual(["B"]);
  });
  test("search includes company reference numbers", () => {
    expect(filterAdminContacts([row("B", "buyer")], "all", "all", "PS-1234", "name").length).toBe(1);
    expect(filterAdminContacts([row("B", "buyer")], "all", "all", "absent", "name").length).toBe(0);
  });
  test("requires both stored Control and Admin authorization", async () => {
    for (const [control, role] of [[false, "admin"], [true, "buyer"], [true, "seller"], [true, "advisor"]]) {
      await expect(requireHelpAdmin({ userId: "me", supabase: { rpc: async () => ({ data: control }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { account_role: role } }) }) }) }) } })).rejects.toThrow("Forbidden");
    }
  });
  test("loads beyond the 1000-row limit", async () => {
    const calls: number[] = [];
    const chain: any = { select: () => chain, order: () => chain, in: () => chain, range: async (start: number) => { calls.push(start); return { data: start === 0 ? Array.from({ length: 1000 }, (_, id) => ({ id })) : [{ id: 1000 }] }; } };
    expect((await contactRows({ from: () => chain }, "users", "id")).length).toBe(1001);
    expect(calls).toEqual([0, 1000]);
  });
  test("deduplicates people with multiple seller membership paths and includes draft profiles", async () => {
    const data: Record<string, any[]> = {
      users: [{ id: "seller", first_name: "Seller", email: "s@example.test", account_role: "seller", status: "Active", created_at: "2026-10-27" }],
      startups: [{ id: "org", created_by: "seller", startup_name: "Company" }],
      startup_users: [{ id: "member", user_id: "seller", startup_id: "org" }], startup_ownership: [{ id: "owner", owning_agent_user_id: "seller", startup_id: "org" }],
      hidden_profiles: [{ id: "hidden", startup_id: "org", ref_no: "PS-1234", approval_status: "draft" }],
    };
    const sb = {auth: {admin: {listUsers: async () => ({data:{users:[{id:'seller',last_sign_in_at:'2026-10-26T12:00:00Z'}]}})}}, from: (table: string) => { const c: any = { select: () => c, order: () => c, in: () => c, range: async () => ({ data: data[table] || [] }) }; return c; } };
    const out = await loadAdminContacts(sb);
    expect(out.length).toBe(1);
    expect(out[0]?.organisations).toEqual([{ id: "org", name: "Company", ref: "PS-1234", kind: "seller", status: "draft" }]);
    expect(out[0]?.lastActive).toBe('2026-10-26T12:00:00Z');
  });
  test('Active account with a draft listing shows Draft', () => expect(contactProfileStatus(row('S','seller'))).toBe('Draft'));
  test('live listings show Live', () => {const c=row('S','seller'); c.organisations[0].status='live'; expect(contactProfileStatus(c)).toBe('Live');});
  test('buyer pending profiles show In review', () => {const c=row('B','buyer'); c.organisations[0].status='in_review'; expect(contactProfileStatus(c)).toBe('In review');});
  test('advisor pending verification shows Checking', () => {const c=row('A','advisor'); c.organisations[0].status='pending'; expect(contactProfileStatus(c)).toBe('Checking');});
  test('advisor verified firm shows Verified', () => {const c=row('A','advisor'); c.organisations[0].status='verified'; expect(contactProfileStatus(c)).toBe('Verified');});
  test('no company shows No profile yet', () => {const c=row('S','seller');c.organisations=[];expect(contactProfileStatus(c)).toBe('No profile yet');});
  test('status filtering uses profile rather than account status', () => expect(filterAdminContacts([row('S','seller')],'all','Draft','','recent').length).toBe(1));
  test('type filter works alongside role tabs', () => expect(filterAdminContacts([row('S','seller')],'seller','all','','recent','buyer')).toEqual([]));
  test('last-active sort puts most recent first', () => {const a=row('A','buyer'),b=row('B','buyer');b.lastActive='2026-10-27';expect(filterAdminContacts([a,b],'all','all','','active').map(c=>c.id)).toEqual(['B','A']);});
  test('approved unexpired NDAs count; ended, expired and unapproved do not', () => {
    const now=Date.parse('2026-10-27T00:00:00Z');const p={status:'active',nda_approved_at:'2026-10-26T00:00:00Z',nda_expires_at:'2026-10-28T00:00:00Z'};
    expect(activeContactNda(p,now)).toBe(true);
    for(const status of ['ended','declined','withdrawn','revoked']) expect(activeContactNda({...p,status},now)).toBe(false);
    expect(activeContactNda({...p,nda_expires_at:'2026-10-27T00:00:00Z'},now)).toBe(false);
    expect(activeContactNda({...p,nda_approved_at:null},now)).toBe(false);
  });
  test('NDA default expiry is 730 days', () => {const p={status:'active',nda_approved_at:'2024-10-27T00:00:00Z'};expect(activeContactNda(p,Date.parse(p.nda_approved_at)+730*864e5)).toBe(false);expect(activeContactNda(p,Date.parse(p.nda_approved_at)+730*864e5-1)).toBe(true);});
  test('last sign-in age uses Bangkok days', () => {expect(contactActiveAge('2026-10-26T17:01:00Z',Date.parse('2026-10-27T08:00:00Z'))).toEqual({unit:'today',n:0});expect(contactActiveAge(null)).toBeNull();});
});