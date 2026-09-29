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
export type ThreadSummary = { key: string; last: { body: string; mine: boolean; at: string } | null; unread: number };

const ACCEPT = /\.(pdf|docx?|xlsx?|csv|png|jpe?g|gif|webp)$/i;
const MAX = 25 * 1024 * 1024;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function myPipelineIds(sb: any, userId: string, as: "seller" | "buyer") {
  if (as === "buyer") {
    const { data } = await sb.from("deal_pipelines").select("id").eq("buyer_user_id", userId).not("nda_approved_at", "is", null).neq("status", "declined");
    return (data ?? []).map((r: any) => r.id as string);
  }
  const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId);
  const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", userId);
  const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
  if (!ids.length) return [];
  const { data } = await sb.from("deal_pipelines").select("id").in("startup_id", ids).not("nda_approved_at", "is", null).neq("status", "declined");
  return (data ?? []).map((r: any) => r.id as string);
}

/** Throws unless the caller belongs to the thread. Returns whether it is closed. */
async function assertMember(ctx: { supabase: any; userId: string }, key: string) {
  const { data } = await ctx.supabase.rpc("can_read_message_thread", { _uid: ctx.userId, _key: key });
  if (!data) throw new Error("You are not part of this conversation");
  if (key.startsWith("p:")) {
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("status, nda_approved_at, nda_expires_at").eq("id", key.slice(2)).single();
    const exp = p?.nda_expires_at ?? (p?.nda_approved_at ? new Date(new Date(p.nda_approved_at).getTime() + 730 * 86_400_000).toISOString() : null);
    const closed = ["revoked", "expired", "declined"].includes(p?.status) || (!!exp && new Date(exp) < new Date());
    return { closed };
  }
  return { closed: false };
}

const Key = z.string().regex(/^(p|a):[0-9a-f-]{36}$/);

export const threadSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context }): Promise<ThreadSummary[]> => {
    const sb = await admin();
    const keys = [...(await myPipelineIds(sb, context.userId, data.as)).map((id: string) => `p:${id}`), `a:${context.userId}`];
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      sb.from("marketplace_messages").select("thread_key, sender_id, body, files, created_at").in("thread_key", keys).order("created_at", { ascending: false }).limit(3000),
      sb.from("marketplace_message_reads").select("thread_key, read_at").eq("user_id", context.userId).in("thread_key", keys),
    ]);
    const readAt = Object.fromEntries((reads ?? []).map((r: any) => [r.thread_key, r.read_at]));
    return keys.map((key) => {
      const list = (msgs ?? []).filter((m: any) => m.thread_key === key);
      const l = list[0];
      const unread = list.filter((m: any) => m.sender_id !== context.userId && (!readAt[key] || m.created_at > readAt[key])).length;
      return {
        key,
        unread,
        last: l ? { body: l.body || (l.files?.[0]?.name ? `📎 ${l.files[0].name}` : ""), mine: l.sender_id === context.userId, at: l.created_at } : null,
      };
    });
  });

export const threadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key }).parse(d))
  .handler(async ({ data, context }) => {
    const { closed } = await assertMember(context, data.key);
    const sb = await admin();
    const [{ data: msgs }, { data: reads }, { data: me }, { data: prof }] = await Promise.all([
      sb.from("marketplace_messages").select("*").eq("thread_key", data.key).order("created_at", { ascending: true }).limit(2000),
      sb.from("marketplace_message_reads").select("user_id, read_at").eq("thread_key", data.key).neq("user_id", context.userId),
      sb.from("users").select("first_name, last_name, email").eq("id", context.userId).maybeSingle(),
      sb.from("user_profiles").select("title, organisation").eq("user_id", context.userId).maybeSingle(),
    ]);
    const otherRead = (reads ?? []).map((r: any) => r.read_at as string).sort().pop() ?? null;
    return {
      closed,
      otherReadAt: otherRead,
      me: { name: [me?.first_name, me?.last_name].filter(Boolean).join(" ") || me?.email || "Me", role: prof?.title ?? null, company: prof?.organisation ?? null },
      messages: (msgs ?? []).map((m: any): ThreadMessage => ({ id: m.id, senderId: m.sender_id, mine: m.sender_id === context.userId, body: m.body, files: m.files ?? [], at: m.created_at })),
    };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context, data.key);
    const sb = await admin();
    await sb.from("marketplace_message_reads").upsert({ thread_key: data.key, user_id: context.userId, read_at: new Date().toISOString() });
    return { ok: true };
  });

const FileZ = z.object({ path: z.string().max(400), name: z.string().max(200), size: z.number().int().min(0).max(MAX), type: z.string().max(120) });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: Key, body: z.string().max(5000), files: z.array(FileZ).max(10).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { closed } = await assertMember(context, data.key);
    if (closed) throw new Error("This conversation is closed because the NDA ended.");
    if (!data.body.trim() && !data.files.length) throw new Error("Message is empty");
    if (data.files.some((f) => !f.path.startsWith(`${data.key.replace(":", "_")}/`))) throw new Error("Invalid file");
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
    const path = `${data.key.replace(":", "_")}/${crypto.randomUUID()}/${safe}`;
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
    if (!data.path.startsWith(`${data.key.replace(":", "_")}/`)) throw new Error("Invalid file");
    const sb = await admin();
    const { data: s, error } = await sb.storage.from("message-files").createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl as string };
  });
