import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marketplace messages. One thread per NDA-approved deal ('p:<pipeline id>')
 * plus one thread per user with the PitchSnack advisor ('a:<user id>').
 * Every read/write checks thread membership server-side, then uses the
 * service client. Pipeline events are read from deal_pipelines, not stored.
 */

export type MsgFile = { path: string; name: string; size: number; type: string };
export type ThreadMessage = { id: string; senderId: string; mine: boolean; body: string; files: MsgFile[]; at: string };
export type ThreadSummary = { key: string; last: { body: string; mine: boolean; at: string; from: string | null } | null; unread: number; meta: DaMeta | null; enq?: EnqMeta | null };
import type { DaMeta, EnqMeta, Member, ThreadEvent, Role } from "./message-threads.server";
import type { EnquiryThread } from "./advisor-enquiries.server";
export type { DaMeta, EnqMeta, Member, ThreadEvent, Role, EnquiryThread };

const ACCEPT = /\.(pdf|docx?|xlsx?|csv|png|jpe?g|gif|webp)$/i;
const MAX = 25 * 1024 * 1024;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function myPipelineIds(sb: any, userId: string, as: "seller" | "buyer" | "advisor") {
  if (as === "advisor") return [] as string[];
  if (as === "buyer") {
    const { data } = await sb.from("deal_pipelines").select("id").eq("buyer_user_id", userId).not("nda_approved_at", "is", null).neq("status", "declined");
    return (data ?? []).map((r: any) => r.id as string);
  }
  const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId);
  const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", userId);
  const ids = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(userId, [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))]);
  if (!ids.length) return [];
  const { data } = await sb.from("deal_pipelines").select("id").in("startup_id", ids).not("nda_approved_at", "is", null).neq("status", "declined");
  return (data ?? []).map((r: any) => r.id as string);
}

/** "This conversation is closed because {org} withdrew from the deal on {date}." */
async function endedNote(sb: any, dealId: string) {
  const { data: w } = await sb.from("deal_withdrawals").select("side, withdrawn_at").eq("deal_id", dealId).maybeSingle();
  const { data: d } = await sb.from("deal_pipelines").select("*").eq("id", dealId).maybeSingle();
  if (!w || !d) return null;
  const { dealParties } = await import("./advisor-pipeline.server");
  const pp = (await dealParties(sb, [d]))[d.id];
  const date = new Date(w.withdrawn_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  return { org: w.side === "seller" ? pp.seller.name : pp.buyer.name, date };
}

/** Throws unless the caller belongs to the thread. Returns whether it is closed. */
async function assertMember(ctx: { supabase: any; userId: string }, key: string) {
  if (key.startsWith("a:")) {
    if (key !== `a:${ctx.userId}`) await (await import("./admin-help.server")).requireHelpAdmin(ctx);
    return { closed: false };
  }
  if (key.startsWith("e:")) {
    const E = await import("./advisor-enquiries.server");
    const m = await E.enquiryMember(await admin(), ctx.userId, key);
    if (!m) throw new Error("You are not part of this conversation");
    return { closed: m.closed };
  }
  if (key.startsWith("c:")) {
    const T = await import("./message-threads.server");
    const m = await T.daMember(await admin(), ctx.userId, key);
    if (!m) throw new Error("You are not part of this conversation");
    if (m.deal?.status === "ended") return { closed: true, endedNote: await endedNote(await admin(), m.deal.id) };
    return { closed: m.closed };
  }
  const { data } = await ctx.supabase.rpc("can_read_message_thread", { _uid: ctx.userId, _key: key });
  if (!data) throw new Error("You are not part of this conversation");
  if (key.startsWith("p:")) {
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("status, nda_approved_at, nda_expires_at").eq("id", key.slice(2)).single();
    if (p?.status === "ended") return { closed: true, endedNote: await endedNote(sb, key.slice(2)) };
    const exp = p?.nda_expires_at ?? (p?.nda_approved_at ? new Date(new Date(p.nda_approved_at).getTime() + 730 * 86_400_000).toISOString() : null);
    const closed = ["revoked", "expired", "declined"].includes(p?.status) || (!!exp && new Date(exp) < new Date());
    return { closed };
  }
  return { closed: false };
}

const Key = z.string().regex(/^((p|a|e):[0-9a-f-]{36}|c:[0-9a-f-]{36}:(seller|buyer))$/);
const As = z.object({ as: z.enum(["seller", "buyer", "advisor"]) });
const fileDir = (key: string) => key.replace(/:/g, "_");

/** Every conversation key of the caller in one tab, and the deal-advisor ones' details. */
async function myKeys(sb: any, userId: string, as: "seller" | "buyer" | "advisor") {
  const T = await import("./message-threads.server");
  const pids = await myPipelineIds(sb, userId, as);
  const [meta, enq] = await Promise.all([T.daThreads(sb, userId, as, pids), T.enqThreads(sb, userId, as)]);
  return { keys: [...pids.map((id: string) => `p:${id}`), ...meta.map((m) => m.key), ...enq.map((m) => m.key), `a:${userId}`], meta, enq };
}

export const threadSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => As.parse(d))
  .handler(async ({ data, context }): Promise<ThreadSummary[]> => {
    const sb = await admin();
    const { keys, meta, enq } = await myKeys(sb, context.userId, data.as);
    const enqBy = Object.fromEntries(enq.map((m) => [m.key, m]));
    const metaBy = Object.fromEntries(meta.map((m) => [m.key, m]));
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      sb.from("marketplace_messages").select("thread_key, sender_id, body, files, created_at").in("thread_key", keys).order("created_at", { ascending: false }).limit(3000),
      sb.from("marketplace_message_reads").select("thread_key, read_at").eq("user_id", context.userId).in("thread_key", keys),
    ]);
    const readAt = Object.fromEntries((reads ?? []).map((r: any) => [r.thread_key, r.read_at]));
    // Colleagues (same side) get their first name before the preview.
    const { data: sides } = await sb.from("deal_pipelines").select("id, buyer_user_id").in("id", keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2)).concat(["00000000-0000-0000-0000-000000000000"]));
    const buyerOf = Object.fromEntries((sides ?? []).map((d: any) => [d.id, d.buyer_user_id]));
    const daIds = meta.map((m) => m.daId);
    const { data: daRows } = daIds.length ? await sb.from("deal_advisors").select("id, advisor_user_id").in("id", daIds) : { data: [] };
    const advOf = Object.fromEntries((daRows ?? []).map((d: any) => [d.id, d.advisor_user_id]));
    const isColleague = (key: string, sender: string) => {
      if (sender === context.userId || key.startsWith("a:") || key.startsWith("e:") || data.as === "advisor") return false;
      if (key.startsWith("p:")) return data.as === "seller" && sender !== buyerOf[key.slice(2)];
      return sender !== advOf[metaBy[key]?.daId];
    };
    const colleagueIds = [...new Set((msgs ?? []).filter((m: any) => isColleague(m.thread_key, m.sender_id)).map((m: any) => m.sender_id))];
    const { data: cu } = colleagueIds.length ? await sb.from("users").select("id, first_name, email").in("id", colleagueIds) : { data: [] };
    const firstOf = Object.fromEntries((cu ?? []).map((u: any) => [u.id, u.first_name || u.email]));
    return keys.map((key) => {
      const list = (msgs ?? []).filter((m: any) => m.thread_key === key);
      const l = list[0];
      const unread = list.filter((m: any) => m.sender_id !== context.userId && (!readAt[key] || m.created_at > readAt[key])).length;
      return {
        key,
        unread,
        meta: metaBy[key] ?? null,
        enq: enqBy[key] ?? null,
        last: l ? { body: l.body || (l.files?.[0]?.name ? `📎 ${l.files[0].name}` : ""), mine: l.sender_id === context.userId, at: l.created_at, from: isColleague(key, l.sender_id) ? firstOf[l.sender_id] ?? null : null } : null,
      };
    });
  });

/** Light unread total for the Messages menu badge. */
export const messagesBadgeCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => As.parse(d))
  .handler(async ({ data, context }): Promise<number> => {
    const sb = await admin();
    const { keys } = await myKeys(sb, context.userId, data.as);
    const { data: reads } = await sb.from("marketplace_message_reads").select("thread_key, read_at").eq("user_id", context.userId).in("thread_key", keys);
    const readAt: Record<string, string> = Object.fromEntries((reads ?? []).map((r: any) => [r.thread_key, r.read_at]));
    const counts = await Promise.all(keys.map(async (key) => {
      let q = sb.from("marketplace_messages").select("id", { count: "exact", head: true }).eq("thread_key", key).neq("sender_id", context.userId);
      if (readAt[key]) q = q.gt("created_at", readAt[key]);
      const { count } = await q;
      return count ?? 0;
    }));
    return counts.reduce((a, b) => a + b, 0);
  });

export const threadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key }).parse(d))
  .handler(async ({ data, context }) => {
    const { closed, endedNote } = await assertMember(context, data.key) as { closed: boolean; endedNote?: { org: string; date: string } | null };
    const sb = await admin();
    if (data.key.startsWith("a:")) {
      const H = await import("./admin-help.server");
      const isAdminView = data.key !== `a:${context.userId}`;
      const userId = data.key.slice(2);
      const adminIds = await H.helpAdminIds(sb);
      const allMsgs: any[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error } = await sb.from("marketplace_messages").select("*").eq("thread_key", data.key).order("created_at", { ascending: true }).range(offset, offset + 999);
        if (error) throw new Error(error.message);
        allMsgs.push(...(page ?? []));
        if ((page ?? []).length < 1000) break;
      }
      const { data: receipts, error } = await sb.from("marketplace_message_reads").select("user_id, read_at").eq("thread_key", data.key);
      if (error) throw new Error(error.message);
      const { data: adminNames } = isAdminView && adminIds.length ? await sb.from("users").select("id, first_name").in("id", adminIds) : { data: [] };
      const names = Object.fromEntries((adminNames ?? []).map((u: any) => [u.id, u.first_name]));
      const { data: assigned } = await sb.from("subscriptions").select("manager_user_id").eq("user_id", userId).maybeSingle();
      const { data: advisor } = assigned?.manager_user_id ? await sb.from("users").select("first_name, last_name").eq("id", assigned.manager_user_id).maybeSingle() : { data: null };
      const advisorName = advisor ? [advisor.first_name, advisor.last_name].filter(Boolean).join(" ") || null : null;
      const visibleReads = (receipts ?? []).filter((r: any) => isAdminView ? r.user_id === userId : adminIds.includes(r.user_id));
      return {
        closed: false, endedNote: null, meId: context.userId, members: [] as Member[], myRole: null as Role | null,
        events: [] as ThreadEvent[], enquiry: null as EnquiryThread | null,
        otherReadAt: visibleReads.map((r: any) => r.read_at as string).sort().pop() ?? null,
        me: { name: "", role: null, company: null }, helpAdvisor: advisorName,
        adminProfile: isAdminView ? await H.helpProfile(sb, userId) : null,
        adminNames: names,
        messages: allMsgs.map((m): ThreadMessage => ({ id: m.id, senderId: isAdminView ? m.sender_id : m.sender_id === userId ? userId : "help-desk", mine: isAdminView ? m.sender_id !== userId : m.sender_id === userId, body: m.body, files: m.files ?? [], at: m.created_at })),
      };
    }
    const [{ data: msgs }, { data: reads }, { data: me }, { data: prof }] = await Promise.all([
      sb.from("marketplace_messages").select("*").eq("thread_key", data.key).order("created_at", { ascending: true }).limit(2000),
      sb.from("marketplace_message_reads").select("user_id, read_at").eq("thread_key", data.key).neq("user_id", context.userId),
      sb.from("users").select("first_name, last_name, email").eq("id", context.userId).maybeSingle(),
      sb.from("user_profiles").select("title, organisation").eq("user_id", context.userId).maybeSingle(),
    ]);
    const T = await import("./message-threads.server");
    const [members, events] = await Promise.all([T.threadMembers(sb, data.key), T.threadEvents(sb, context.userId, data.key)]);
    const myRole = members.find((m) => m.id === context.userId)?.role ?? null;
    let enquiry: EnquiryThread | null = null;
    let enqEvents: ThreadEvent[] = [];
    if (data.key.startsWith("e:")) {
      const E = await import("./advisor-enquiries.server");
      const m = await E.enquiryMember(sb, context.userId, data.key);
      if (m) { const r = await E.enquiryThread(sb, context.userId, m); enquiry = r.thread; enqEvents = r.events as any; }
    }
    const otherIds = new Set(members.filter((m) => m.role !== myRole).map((m) => m.id));
    // Admins on the other company show as one "PitchSnack team" entry; never their own details.
    const { adminUserIds } = await import("./managed.server");
    const teamIds = await adminUserIds(sb, [...otherIds]);
    const TEAM = "pitchsnack-team";
    const firstTeam = members.find((m) => teamIds.has(m.id));
    if (firstTeam) {
      const kept = members.filter((m) => !teamIds.has(m.id));
      members.length = 0;
      members.push({ id: TEAM, name: "PitchSnack team", first: "PitchSnack team", title: null, org: firstTeam.org, role: firstTeam.role, main: firstTeam.main || true, team: true }, ...kept);
    }
    // Seen = someone in the other organisation opened it (PitchSnack Help: anyone else).
    const otherRead = (reads ?? []).filter((r: any) => !members.length || otherIds.has(r.user_id)).map((r: any) => r.read_at as string).sort().pop() ?? null;
    return {
      closed,
      endedNote: endedNote ?? null,
      meId: context.userId,
      members,
      myRole,
      events: enquiry ? enqEvents : events,
      enquiry,
      otherReadAt: otherRead,
      me: { name: [me?.first_name, me?.last_name].filter(Boolean).join(" ") || me?.email || "Me", role: prof?.title ?? null, company: prof?.organisation ?? null },
      messages: (msgs ?? []).map((m: any): ThreadMessage => ({ id: m.id, senderId: teamIds.has(m.sender_id) ? TEAM : m.sender_id, mine: m.sender_id === context.userId, body: m.body, files: m.files ?? [], at: m.created_at })),
    };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.key);
    const sb = await admin();
    if (data.key.startsWith("e:")) {
      // The firm opening it marks its enquiries read.
      const { data: c } = await sb.from("advisor_conversations").select("firm_profile_id").eq("id", data.key.slice(2)).maybeSingle();
      const { data: f } = c ? await sb.from("advisor_firms").select("owner_user_id").eq("id", c.firm_profile_id).maybeSingle() : { data: null };
      if (f?.owner_user_id === context.userId) await sb.from("advisor_enquiries").update({ read_at: new Date().toISOString() }).eq("conversation_id", data.key.slice(2)).is("read_at", null);
    }
    const { error } = await sb.from("marketplace_message_reads").upsert({ thread_key: data.key, user_id: context.userId, read_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FileZ = z.object({ path: z.string().max(400), name: z.string().max(200), size: z.number().int().min(0).max(MAX), type: z.string().max(120) });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key, body: z.string().max(5000), files: z.array(FileZ).max(10).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { closed } = await assertMember(context, data.key);
    if (closed) throw new Error("This conversation is closed.");
    if (!data.body.trim() && !data.files.length) throw new Error("Message is empty");
    if (data.files.some((f) => !f.path.startsWith(`${fileDir(data.key)}/`))) throw new Error("Invalid file");
    const sb = await admin();
    const now = new Date().toISOString();
    const { error } = await sb.from("marketplace_messages").insert({ thread_key: data.key, sender_id: context.userId, body: data.body.trim(), files: data.files, created_at: now });
    if (error) throw new Error(error.message);
    await sb.from("marketplace_message_reads").upsert({ thread_key: data.key, user_id: context.userId, read_at: now });
    return { ok: true };
  });

export const messageUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key, name: z.string().min(1).max(200), size: z.number().int().min(1).max(MAX) }).parse(d))
  .handler(async ({ data, context }) => {
    const { closed } = await assertMember(context, data.key);
    if (closed) throw new Error("This conversation is closed");
    if (!ACCEPT.test(data.name)) throw new Error("Only PDF, Word, Excel and image files");
    const safe = data.name.replace(/[^\w.\- ]+/g, "_");
    const path = `${fileDir(data.key)}/${crypto.randomUUID()}/${safe}`;
    const sb = await admin();
    const { data: up, error } = await sb.storage.from("message-files").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: up.token as string };
  });

export const messageFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key, path: z.string().max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.key);
    if (!data.path.startsWith(`${fileDir(data.key)}/`)) throw new Error("Invalid file");
    const sb = await admin();
    const { data: s, error } = await sb.storage.from("message-files").createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl as string };
  });
