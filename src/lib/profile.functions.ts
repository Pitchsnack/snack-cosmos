import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const opt = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        firstName: opt(100),
        lastName: opt(100),
        title: opt(120),
        organisation: opt(160),
        bio: opt(600),
        city: opt(100),
        country: opt(100),
        website: opt(255),
        linkedin: opt(255),
        phone: opt(40),
        industryFocus: opt(200),
        functionalExpertise: opt(200),
        buyerType: opt(100),
        experience: opt(60),
      })
      .partial()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if ("firstName" in data || "lastName" in data) {
      const patch: Record<string, string | null> = {};
      if ("firstName" in data) patch.first_name = data.firstName ?? null;
      if ("lastName" in data) patch.last_name = data.lastName ?? null;
      const { error } = await supabase.from("users").update(patch).eq("id", userId);
      if (error) throw new Error(error.message);
    }
    const map: Record<string, string> = {
      title: "title", organisation: "organisation", bio: "bio", city: "city",
      country: "country", website: "website", linkedin: "linkedin", phone: "phone",
      industryFocus: "industry_focus", functionalExpertise: "functional_expertise",
      buyerType: "buyer_type", experience: "experience",
    };
    const row: Record<string, string | null> = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in data) row[col] = (data as Record<string, string | null>)[k] ?? null;
    }
    if (Object.keys(row).length) {
      const { error } = await supabase
        .from("user_profiles")
        .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getMyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: owned }, { data: user }] = await Promise.all([
      supabase.from("deal_ownership").select("deals!inner(stage)").eq("owning_agent_user_id", userId),
      supabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
    ]);
    const dealsClosed = (owned ?? []).filter((r) => {
      const s = (r.deals as unknown as { stage: string | null } | null)?.stage ?? "";
      return /closed/i.test(s) && !/lost/i.test(s);
    }).length;
    // NDA workflow not built yet — no approved NDAs can exist.
    return { dealsClosed, ndas: 0, memberSince: (user?.created_at as string | null) ?? null };
  });
