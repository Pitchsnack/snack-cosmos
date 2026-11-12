import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INDIVIDUAL_TYPE, sortActsFor } from "@/lib/investor-bands";

/**
 * Self sign-up: the account's sign-up answers (signup_answers) and the
 * Draft profile made from step 5. Writes go through the service client,
 * always scoped to the verified caller.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** New sign-ups register only at "Yes, this is my company" (confirmRegCompany); these older entry points stay for Drafts already made. */
async function requireDone(uid: string) {
  const sb = await admin();
  const { data } = await sb.from("signup_answers").select("done_at").eq("user_id", uid).maybeSingle();
  if (!data?.done_at) throw new Error("Verify your company first.");
}

const RELATIONS = ["individual", "corporate", "agent"] as const;

export const ROLES = ["seller", "buyer", "advisor"] as const;
export type SignupRole = (typeof ROLES)[number];
export type SignupState = {
  email: string; confirmed: boolean; provider: string | null;
  /** users.signup_done_at is set: sign-up's last step (the sector question) is answered, or the account didn't need it. */
  signupDone: boolean;
  /** The sector answer read from the profile, for Admin's "Saved when you signed up" box. */
  sector: { label: string; text: string } | null;
  answers: null | {
    role: SignupRole; first_answer: string; investor_types?: string[] | null; buyer_relation?: string | null; first_name: string | null; last_name: string | null;
    company: { name: string; year: string | null; size: string | null; website: string | null } | null;
    profile_id: string | null; done_at: string | null; welcome_seen_at: string | null;
  };
};

export const getSignupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignupState> => {
    const sb = await admin();
    const [{ data: u }, { data: a }, { data: me }] = await Promise.all([
      sb.auth.admin.getUserById(context.userId),
      sb.from("signup_answers").select("*").eq("user_id", context.userId).maybeSingle(),
      sb.from("users").select("signup_done_at").eq("id", context.userId).maybeSingle(),
    ]);
    const user = u?.user;
    let sector: SignupState["sector"] = null;
    const fs = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
    if (a?.profile_id && a.done_at) {
      const { sectorGroupOf } = await import("@/lib/sectors");
      const { normPicks, picksSummary } = await import("@/lib/business-types");
      if (a.role === "seller") {
        const { data: st } = await sb.from("startups").select("sector, setup_from_signup").eq("id", a.profile_id).maybeSingle();
        if (st?.sector && fs(st.setup_from_signup).includes("sector")) sector = { label: "Business sector", text: `${sectorGroupOf(st.sector) ?? ""} › ${st.sector}` };
      } else if (a.role === "buyer") {
        const { data: iv } = await sb.from("investors").select("preferred_industries, sector_picks, wizard").eq("id", a.profile_id).maybeSingle();
        const ind = fs(iv?.preferred_industries);
        if (ind.length && fs(iv?.wizard?.from_signup).includes("sectors")) sector = { label: "Industries", text: ind.includes("Sector Agnostic") ? "Sector agnostic" : picksSummary(normPicks(iv?.sector_picks)) || ind.join(", ") };
      } else if (a.role === "advisor") {
        const { data: f } = await sb.from("advisor_firms").select("sectors, sector_agnostic, sector_picks, wizard_state").eq("id", a.profile_id).maybeSingle();
        if (f && fs(f.wizard_state?.fromSignup).includes("sectors") && (f.sector_agnostic || fs(f.sectors).length)) sector = { label: "Sectors", text: f.sector_agnostic ? "Sector agnostic" : picksSummary(normPicks(f.sector_picks)) || fs(f.sectors).join(", ") };
      }
    }
    return {
      email: user?.email ?? "",
      confirmed: !!user?.email_confirmed_at,
      provider: (user?.app_metadata?.provider as string) ?? null,
      signupDone: !!me?.signup_done_at,
      sector,
      answers: a ?? null,
    };
  });

/** Saves the step 1–3 answers once the account exists (email or Google/Microsoft). */
export const saveSignupAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(ROLES), firstAnswer: z.string().min(1).max(60),
    investorTypes: z.array(z.string().max(60)).max(7).optional(),
    firstName: z.string().trim().max(100).optional(), lastName: z.string().trim().max(100).optional(),
    terms: z.boolean(), news: z.boolean(), provider: z.string().max(20).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: cur } = await sb.from("signup_answers").select("done_at").eq("user_id", context.userId).maybeSingle();
    if (cur?.done_at) return { ok: true, done: true };
    const { data: u } = await sb.auth.admin.getUserById(context.userId);
    const meta = (u?.user?.user_metadata ?? {}) as Record<string, string>;
    const first = data.firstName || meta.given_name || (meta.full_name ?? meta.name ?? "").split(" ")[0] || null;
    const last = data.lastName || meta.family_name || (meta.full_name ?? meta.name ?? "").split(" ").slice(1).join(" ") || null;
    const { error } = await sb.from("signup_answers").upsert({
      user_id: context.userId, role: data.role, first_answer: data.firstAnswer,
      // Buyers: step 2 is who they are (buyer_relation); the type or types come from the type step.
      buyer_relation: data.role === "buyer" && RELATIONS.includes(data.firstAnswer as never) ? data.firstAnswer : null,
      investor_types: data.role === "buyer"
        ? (data.firstAnswer === "individual" ? [INDIVIDUAL_TYPE] : data.firstAnswer === "corporate" ? sortActsFor(data.investorTypes).filter((t) => t !== INDIVIDUAL_TYPE).slice(0, 1) : sortActsFor(data.investorTypes))
        : [],
      first_name: first, last_name: last, provider: data.provider ?? null,
      terms_accepted_at: data.terms ? new Date().toISOString() : null, news_opt_in: data.news,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await sb.from("users").update({ first_name: first, last_name: last }).eq("id", context.userId);
    return { ok: true, done: false };
  });

const SIZE_TO_BUYER: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "500+" };

/** Step 5: makes the Draft profile from the sign-up answers. */
export const finishSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().trim().min(2).max(120),
    year: z.string().regex(/^\d{4}$/).nullable(),
    size: z.string().max(10).nullable(),
    website: z.string().trim().max(200).nullable(),
    lang: z.enum(["en", "th"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => { await requireDone(context.userId); const { doFinish } = await import("./signup-core.server"); return doFinish(context.userId, data); });

export const dismissWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    await sb.from("signup_answers").update({ welcome_seen_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });

const PICKS = z.object({
  types: z.array(z.string().max(30)).max(5),
  kinds: z.record(z.string().max(20), z.array(z.string().max(30)).max(20)),
  other: z.array(z.string().max(80)).max(80),
});

/** Sign-up's last step: saves the sector answer to the Draft, marks it a sign-up answer, finishes sign-up. */
export const saveSignupSector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    sector: z.string().max(120).nullable().optional(),
    pick: z.object({ type: z.string().max(30), kind: z.string().max(30).optional() }).nullable().optional(),
    picks: PICKS.nullable().optional(),
    agnostic: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => { await requireDone(context.userId); const { doSaveSector } = await import("./signup-core.server"); return doSaveSector(context.userId, data as never); });
