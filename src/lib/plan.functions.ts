import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanStrip = {
  role: "seller" | "buyer" | "advisor" | "admin" | null;
  plan: null | {
    key: string; name: string; badgeStyle: string; priceType: string; priceThb: number | null; termMonths: number;
    completionFeePct: number | null; valueCapM: number | null; requestsMode: string;
    features: { label: string; on: boolean; needs?: string }[];
  };
  ended: boolean;
  termEnd: string | null;
  left: number | "unlimited" | null;
  total: number | null;
  ndaCredits: number;
  /** A running access-code free plan. */
  free: null | { lastDay: string; daysLeft: number; hiddenToday: boolean };
  /** A free plan that ran its term and whose notice hasn't shown yet. */
  freeEnded: null | { plan: string; lastDay: string };
  /** The plan last had free (kept after the notice), for "You had it free until". */
  freeEndedPlan: string | null; freeEndedOn: string | null;
};

/** Plan strip on the Browse pages. Every value comes from the plans table. */
export const getMyPlanStrip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanStrip> => {
    const { planAccess, requestsLeft } = await import("./plan-access.server");
    const a = await planAccess(context.userId);
    const p = a.plan;
    const {data:verificationQuote}=await context.supabase.rpc('report_quote',{_uid:context.userId,_key:'verification'});
    const verificationFree=(verificationQuote as {left?:number;freePeriod?:boolean}|null)?.freePeriod||(Number((verificationQuote as {left?:number}|null)?.left??0)>0);
    const kind = a.role === "buyer" ? "nda" : "contact";
    const capTxt = (verb: string) => p?.value_cap_thb_m == null ? `${verb} a business of any size` : `${verb} businesses selling for under THB ${Number(p.value_cap_thb_m)}m`;
    const f = (label: string, on: boolean, needs?: string) => ({ label, on, needs: on ? undefined : needs });
    const features = !p ? [] : a.role === "seller"
      ? [
          f(p.value_cap_thb_m == null ? "List a business of any size" : `List a business selling for under THB ${Number(p.value_cap_thb_m)}m`, true),
          f("Receive contact requests", true),
          f("Send contact requests", p.requests_mode !== "none", "Professional"),
          f("Teaser and data room", !!p.has_data_room, "Professional"),
          verificationFree
            ? f("Company and registration verification · Certified badge", true)
            : { label: "Company and registration verification · pay per report", on: false },
          f("Dedicated manager", !!p.has_manager, "Executive"),
          f("Valuation and pitch video", !!p.has_valuation_video, "Executive"),
          f("Site visit", !!p.has_site_visit, "Executive"),
        ]
      : a.role === "buyer"
        ? [
            f(capTxt("See"), true),
            f("Verified search and receive", true),
            f("NDA requests", p.requests_mode !== "none", "Investor"),
            f("Matched shortlists", !!p.has_shortlists, "Investor"),
            f("Screening reports", !!p.has_screening, "Investor"),
            // "Financial reports" chip stays hidden until buyers can order reports themselves.
          ]
        : [
            f("Requests", p.requests_mode !== "none", "Pro"),
            f(`${p.clients_n ?? "Unlimited"} client${p.clients_n === 1 ? "" : "s"}`, true),
            f(`${p.users_n ?? "Unlimited"} user${p.users_n === 1 ? "" : "s"}`, true),
          ];
    return {
      role: a.role,
      plan: p && {
        key: p.key, name: p.name, badgeStyle: p.badge_style, priceType: p.price_type, priceThb: a.sub?.price_locked_thb ?? (a.sub?.term_end && new Date(a.sub.term_end) > new Date() ? a.sub.price_paid_thb : null) ?? p.price_thb, termMonths: p.term_months,
        completionFeePct: p.completion_fee_pct == null ? null : Number(p.completion_fee_pct),
        valueCapM: p.value_cap_thb_m == null ? null : Number(p.value_cap_thb_m), requestsMode: p.requests_mode, features,
      },
      ended: a.ended,
      termEnd: a.sub?.term_end ?? null,
      left: requestsLeft(a, kind),
      total: p?.requests_mode === "number" ? p.requests_n : null,
      ndaCredits: a.sub?.nda_credits ?? 0,
      ...(await freeInfo(context.userId, a.sub)),
    };
  });

async function freeInfo(userId: string, sub: any): Promise<Pick<PlanStrip, "free" | "freeEnded" | "freeEndedPlan" | "freeEndedOn">> {
  const { bkkToday, daysLeft } = await import("./access-codes");
  const { lastDayOf } = await import("./free-plan.server");
  const today = bkkToday();
  const free = sub?.source === "access_code" && sub.status === "active" && sub.term_end
    ? { lastDay: lastDayOf(sub.term_end), daysLeft: daysLeft({ ends_on: lastDayOf(sub.term_end) }) ?? 0, hiddenToday: sub.free_bar_hidden_on === today }
    : null;
  let freeEnded: PlanStrip["freeEnded"] = null;
  let freeEndedPlan: string | null = null, freeEndedOn: string | null = null;
  if (!free) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await (supabaseAdmin as any).from("subscriptions").select("free_ended_on,free_plan_name,free_end_seen_at").eq("user_id", userId).maybeSingle();
    if (s?.free_ended_on && s.free_plan_name && !s.free_end_seen_at) freeEnded = { plan: s.free_plan_name, lastDay: s.free_ended_on };
    if (s?.free_ended_on) { freeEndedPlan = s.free_plan_name; freeEndedOn = s.free_ended_on; }
  }
  return { free, freeEnded, freeEndedPlan, freeEndedOn };
}

/** × on the 14-day bar (hide until tomorrow), or the end notice has shown. */
export const freePlanSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ what: z.enum(["hide_bar", "end_seen"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bkkToday } = await import("./access-codes");
    const patch = data.what === "hide_bar" ? { free_bar_hidden_on: bkkToday() } : { free_end_seen_at: new Date().toISOString() };
    await (supabaseAdmin as any).from("subscriptions").update(patch).eq("user_id", context.userId);
    return { ok: true };
  });

/** Admin: the company's registration verified switch (drives the Certified badge). */
export const getRegistrationVerified = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAccountAdmin } = await import("./plan-access.server");
    await requireAccountAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any).from("startups").select("registration_verified_at").eq("id", data.startupId).maybeSingle();
    return { at: (row?.registration_verified_at as string | null) ?? null };
  });

export const setRegistrationVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAccountAdmin } = await import("./plan-access.server");
    await requireAccountAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const at = data.on ? new Date().toISOString() : null;
    const { error } = await (supabaseAdmin as any).from("startups").update({ registration_verified_at: at }).eq("id", data.startupId);
    if (error) throw new Error(error.message);
    return { at };
  });
