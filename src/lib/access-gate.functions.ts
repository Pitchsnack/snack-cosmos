import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bkkToday, lastFreeDay, type CodeRole } from "./access-codes";

/**
 * Soft-launch gate (public side). The server checks every code and pass; the
 * browser only keeps the signed pass. Tables are read with the service client.
 */
export type GateDetails = {
  code: string; client: string; role: CodeRole; left: number; max: number; months: number;
  plans: { seller: string | null; buyer: string | null; advisor: string | null } | null;
};
export type GateStatus = { gateOn: boolean; works: boolean; inactive?: boolean; details?: GateDetails; invitationEmail?: string };

const ROLES = ["seller", "buyer", "advisor"] as const;
const DAY = 86400000;

async function sbAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
async function hmac(msg: string) {
  const secret = process.env.ACCESS_PASS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) throw new Error("Pass secret missing");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("ps-access-pass:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))));
}
async function signPass(p: { d: string; c: string; e: number; kind?: 'share' }) {
  const body = b64u(new TextEncoder().encode(JSON.stringify(p)));
  return `${body}.${await hmac(body)}`;
}
async function readPass(pass: string | null | undefined): Promise<{ d: string; c: string; e: number; kind?: 'share' } | null> {
  if (!pass) return null;
  const [body, sig] = pass.split(".");
  if (!body || !sig || (await hmac(body)) !== sig) return null;
  try { const p = JSON.parse(fromB64u(body)); return p && typeof p.c === "string" && p.e > Date.now() ? p : null; } catch { return null; }
}

const isActive = (c: any) => !c.switched_off_at && !(c.ends_on && c.ends_on < bkkToday());

/** The plan name the claim would give for each role, by the "Who gets one" rule. */
async function planNames(sb: any, c: any, settings: any) {
  if (!c.free_plan) return null;
  const { data: plans } = await sb.from("plans").select("role,key,name,status,price_type,sort").eq("status", "live").neq("price_type", "free").order("sort");
  const usual = (settings?.usual_free_plans ?? {}) as Record<string, string>;
  const out: Record<string, string | null> = {};
  for (const r of ROLES) {
    const live = (plans ?? []).filter((p: any) => p.role === r);
    const own = c.role === r ? live.find((p: any) => p.key === c.free_plan) : null;
    const pick = own ?? live.find((p: any) => p.key === usual[r]) ?? live[0] ?? null;
    out[r] = pick?.name ?? null;
  }
  return out as GateDetails["plans"];
}
async function planFor(sb: any, c: any, role: string, settings: any) {
  const { data: plans } = await sb.from("plans").select("id,key,role,status,price_type,sort").eq("role", role).eq("status", "live").neq("price_type", "free").order("sort");
  const usual = (settings?.usual_free_plans ?? {}) as Record<string, string>;
  return (c.role === role ? plans?.find((p: any) => p.key === c.free_plan) : null) ?? plans?.find((p: any) => p.key === usual[role]) ?? plans?.[0] ?? null;
}

async function details(sb: any, c: any, settings: any): Promise<GateDetails> {
  const { count } = await sb.from("users").select("id", { count: "exact", head: true }).eq("access_code_id", c.id);
  return {
    code: c.code, client: c.client_name, role: c.role, max: c.max_accounts, months: c.free_months,
    left: Math.max(0, c.max_accounts - (count ?? 0)), plans: await planNames(sb, c, settings),
  };
}

async function visit(sb: any, deviceId: string, codeId: string) {
  const { data: d } = await sb.from("access_devices").select("visits,last_seen_at,code_id").eq("id", deviceId).maybeSingle();
  const now = new Date().toISOString();
  if (!d) { await sb.from("access_devices").insert({ id: deviceId, code_id: codeId }); return; }
  const fresh = Date.now() - Date.parse(d.last_seen_at) > 30 * 60000 || d.code_id !== codeId;
  await sb.from("access_devices").update({ code_id: codeId, last_seen_at: now, ...(fresh ? { visits: d.visits + 1 } : {}) }).eq("id", deviceId);
}

const deviceRe = z.string().regex(/^[A-Za-z0-9-]{8,64}$/);

export const enterShareInvitation = createServerFn({ method: 'POST' })
  .inputValidator(d => z.object({ token: z.string().max(128), deviceId: deviceRe }).parse(d))
  .handler(async ({ data }) => {
    const sb = await sbAdmin();
    const { data: inv } = await sb.from('share_invitations').select('id,email').eq('token', data.token).is('joined_at', null).maybeSingle();
    if (!inv) return { works: false, pass: null, email: null };
    return { works: true, email: inv.email as string, pass: await signPass({ d: data.deviceId, c: inv.id, kind: 'share', e: Date.now() + 30 * DAY }) };
  });

export const accessStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pass: z.string().max(600).nullable(), deviceId: deviceRe.nullable() }).parse(d))
  .handler(async ({ data }): Promise<GateStatus> => {
    const sb = await sbAdmin();
    const { data: s } = await sb.from("soft_launch_settings").select("gate_on,usual_free_plans").eq("id", true).maybeSingle();
    if (!s?.gate_on) return { gateOn: false, works: true };
    const p = await readPass(data.pass);
    if (!p || (data.deviceId && p.d !== data.deviceId)) return { gateOn: true, works: false };
    if (p.kind === 'share') {
      const { data: inv } = await sb.from('share_invitations').select('email').eq('id', p.c).is('joined_at', null).maybeSingle();
      return inv ? { gateOn: true, works: true, invitationEmail: inv.email } : { gateOn: true, works: false };
    }
    const { data: c } = await sb.from("access_codes").select("*").eq("id", p.c).maybeSingle();
    if (!c) return { gateOn: true, works: false };
    if (!isActive(c)) return { gateOn: true, works: false, inactive: true };
    await visit(sb, p.d, c.id);
    return { gateOn: true, works: true, details: await details(sb, c, s) };
  });

export type EnterResult =
  | { result: "works"; pass: string; details: GateDetails }
  | { result: "unknown" | "inactive" }
  | { result: "paused"; minutes: number };

export const accessEnter = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().max(20), remember: z.boolean(), deviceId: deviceRe }).parse(d))
  .handler(async ({ data }): Promise<EnterResult> => {
    const sb = await sbAdmin();
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const keys = [`d:${data.deviceId}`, `ip:${ip}`];
    const { data: fails } = await sb.from("access_failures").select("*").in("key", keys);
    const now = Date.now();
    const paused = (fails ?? []).map((f: any) => (f.paused_until ? Date.parse(f.paused_until) : 0)).reduce((a: number, b: number) => Math.max(a, b), 0);
    if (paused > now) return { result: "paused", minutes: Math.ceil((paused - now) / 60000) };

    const code = data.code.trim().toUpperCase();
    const { data: c } = /^PS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) ? await sb.from("access_codes").select("*").eq("code", code).maybeSingle() : { data: null };
    if (!c) {
      // Count the wrong try: 5 in a row per device, or 20 an hour per IP, pause 15 minutes.
      for (const key of keys) {
        const f = (fails ?? []).find((x: any) => x.key === key);
        const hourOld = !f || now - Date.parse(f.hour_started_at) > 3600000;
        const inRow = (f?.in_a_row ?? 0) + 1;
        const hour = hourOld ? 1 : f.hour_count + 1;
        const pause = key.startsWith("d:") ? inRow >= 5 : hour >= 20;
        await sb.from("access_failures").upsert({
          key, in_a_row: pause && key.startsWith("d:") ? 0 : inRow, hour_count: hour,
          hour_started_at: hourOld ? new Date(now).toISOString() : f.hour_started_at,
          paused_until: pause ? new Date(now + 15 * 60000).toISOString() : f?.paused_until ?? null,
        }, { onConflict: "key" });
        if (pause) return { result: "paused", minutes: 15 };
      }
      return { result: "unknown" };
    }
    await sb.from("access_failures").update({ in_a_row: 0 }).eq("key", keys[0]);
    if (!isActive(c)) return { result: "inactive" };
    const { data: s } = await sb.from("soft_launch_settings").select("usual_free_plans").eq("id", true).maybeSingle();
    await visit(sb, data.deviceId, c.id);
    const pass = await signPass({ d: data.deviceId, c: c.id, e: now + (data.remember ? 30 * DAY : DAY / 2) });
    return { result: "works", pass, details: await details(sb, c, s) };
  });

export type ClaimResult = "works" | "full" | "inactive" | "no_pass";

/** Claims access; rejected passes leave accounts recoverable and unprivileged. */
export const claimAccessSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pass: z.string().max(600).nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<{ result: ClaimResult; code?: string }> => {
    const sb = await sbAdmin();
    const uid = context.userId;
    const { data: s } = await sb.from("soft_launch_settings").select("gate_on,changed_at,usual_free_plans").eq("id", true).maybeSingle();
    if (!s?.gate_on) return { result: "works" };
    const [{ data: u }, { data: a }, { data: au }] = await Promise.all([
      sb.from("users").select("account_role,access_code_id").eq("id", uid).maybeSingle(),
      sb.from("signup_answers").select("role,done_at").eq("user_id", uid).maybeSingle(),
      sb.auth.admin.getUserById(uid),
    ]);
    const created = Date.parse(au?.user?.created_at ?? "");
    // Only a new account: no role, no code, no Draft profile, made while the gate is on.
    const isNew = !u?.account_role && !u?.access_code_id && !a?.done_at && created >= Date.parse(s.changed_at);
    const p = await readPass(data.pass);
    if (p?.kind === 'share') {
      const { data: claimed, error } = await sb.rpc('claim_share_invitation', { _uid: uid, _invitation_id: p.c, _email: au?.user?.email ?? '', _role: u?.account_role ?? a?.role ?? '' });
      if (error) throw new Error('Invitation claim failed');
      // Invitation failures are recoverable; never delete an account or its answers.
      return { result: claimed || !isNew ? 'works' : 'no_pass' };
    }
    if (!isNew) return { result: "works" };

    let result: ClaimResult = "no_pass";
    let codeText: string | undefined;
    let code: any = null;
    if (p) {
      const { data: c } = await sb.from("access_codes").select("*").eq("id", p.c).maybeSingle();
      code = c; codeText = c?.code;
      if (c) {
        const { data: r, error } = await sb.rpc("claim_access_seat", { _uid: uid, _code_id: c.id, _role: a?.role ?? null });
        if (error) throw new Error(error.message);
        result = r === "ok" ? "works" : (r as ClaimResult);
      }
    }
    if (result !== "works") {
      return { result, code: codeText };
    }
    // Free plan: one active subscription; it takes the place of a seller's Entry.
    if (code?.free_plan && a?.role && ROLES.includes(a.role)) {
      const plan = await planFor(sb, code, a.role, s);
      if (plan) {
        const day = bkkToday();
        await sb.from("subscriptions").upsert({
          user_id: uid, plan_id: plan.id, status: "active", term_start: new Date().toISOString(),
          term_end: `${lastFreeDay(day, code.free_months)}T23:59:59+07:00`, price_paid_thb: 0,
          source: "access_code", access_code_id: code.id,
        }, { onConflict: "user_id" });
      }
    }
    return { result: "works" };
  });
