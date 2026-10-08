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
};

/** Plan strip on the Browse pages. Every value comes from the plans table. */
export const getMyPlanStrip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanStrip> => {
    const { planAccess, requestsLeft } = await import("./plan-access.server");
    const a = await planAccess(context.userId);
    const p = a.plan;
    const kind = a.role === "buyer" ? "nda" : "contact";
    const capTxt = (verb: string) => p?.value_cap_thb_m == null ? `${verb} a business of any size` : `${verb} businesses selling for under THB ${Number(p.value_cap_thb_m)}m`;
    const f = (label: string, on: boolean, needs?: string) => ({ label, on, needs: on ? undefined : needs });
    const features = !p ? [] : a.role === "seller"
      ? [
          f(p.value_cap_thb_m == null ? "List a business of any size" : `List a business selling for under THB ${Number(p.value_cap_thb_m)}m`, true),
          f("Receive contact requests", true),
          f("Send contact requests", p.requests_mode !== "none", "Professional"),
          f("Teaser and data room", !!p.has_data_room, "Professional"),
          p.verification_mode === "included"
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
    };
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
