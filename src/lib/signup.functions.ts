import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Self sign-up: the account's sign-up answers (signup_answers) and the
 * Draft profile made from step 5. Writes go through the service client,
 * always scoped to the verified caller.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const ROLES = ["seller", "buyer", "advisor"] as const;
export type SignupRole = (typeof ROLES)[number];
export type SignupState = {
  email: string; confirmed: boolean; provider: string | null;
  answers: null | {
    role: SignupRole; first_answer: string; first_name: string | null; last_name: string | null;
    company: { name: string; year: string | null; size: string | null; website: string | null } | null;
    profile_id: string | null; done_at: string | null; welcome_seen_at: string | null;
  };
};

export const getSignupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignupState> => {
    const sb = await admin();
    const [{ data: u }, { data: a }] = await Promise.all([
      sb.auth.admin.getUserById(context.userId),
      sb.from("signup_answers").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);
    const user = u?.user;
    return {
      email: user?.email ?? "",
      confirmed: !!user?.email_confirmed_at,
      provider: (user?.app_metadata?.provider as string) ?? null,
      answers: a ?? null,
    };
  });

/** Saves the step 1–3 answers once the account exists (email or Google/Microsoft). */
export const saveSignupAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(ROLES), firstAnswer: z.string().min(1).max(60),
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const uid = context.userId;
    const { data: u } = await sb.auth.admin.getUserById(uid);
    if (!u?.user?.email_confirmed_at) throw new Error("Confirm your email first.");
    const { data: a } = await sb.from("signup_answers").select("*").eq("user_id", uid).maybeSingle();
    if (!a) throw new Error("Sign-up answers not found.");
    if (a.done_at) return { role: a.role as SignupRole, profileId: a.profile_id as string | null };
    const y = data.year ? Number(data.year) : null;
    if (y != null && (y < 1800 || y > new Date().getFullYear())) throw new Error("Invalid year.");
    const web = data.website ? data.website.replace(/^https?:\/\//i, "").replace(/\/+$/, "") : null;
    let profileId: string | null = null;

    // `fromSignup` lists the fields sign-up answered; the setup wizards hide them while they still hold a value.
    if (a.role === "advisor") {
      const team = data.size && /^\d{1,5}$/.test(data.size) ? Number(data.size) : null;
      const fromSignup = ["type", "name", ...(web ? ["web"] : []), ...(y ? ["year"] : []), ...(team ? ["team"] : [])];
      await sb.from("users").update({ advisor_view: true }).eq("id", uid);
      const { data: f, error } = await sb.from("advisor_firms").insert({
        owner_user_id: uid, status: "draft", name: data.name, firm_type: a.first_answer, country: "Thailand",
        website: web, year_founded: y, team_size: team, setup_answered: [], wizard_state: { fromSignup },
      }).select("id").single();
      if (error) throw new Error(error.message);
      profileId = f.id;
    } else if (a.role === "buyer") {
      const { ensureLinked } = await import("@/lib/buyer-investor.functions");
      const { investorId } = await ensureLinked(uid);
      const individual = a.first_answer === "Individual Investor";
      const fromSignup = individual ? ["role", "name", ...(web ? ["web"] : [])]
        : ["type", "name", ...(web ? ["web"] : []), ...(y ? ["year"] : []), ...(data.size ? ["size"] : [])];
      const { error } = await sb.from("investors").update({
        investor_name: data.name, investor_type: a.first_answer, website_url: web,
        year_founded: individual ? null : y,
        company_size_band: individual ? null : (data.size ? SIZE_TO_BUYER[data.size] ?? null : null),
        wizard: { answered: [], from_signup: fromSignup },
        updated_by: uid, updated_at: new Date().toISOString(),
      }).eq("id", investorId);
      if (error) throw new Error(error.message);
      if (individual) await sb.from("buyer_profiles").update({ buyer_relation: "individual" }).eq("user_id", uid);
      profileId = investorId;
    } else if (a.role === "seller") {
      const { ensureSellerDraftFromSignup } = await import("@/lib/seller-setup.server");
      profileId = await ensureSellerDraftFromSignup(sb, uid, { ...a, profile_id: null, company: { name: data.name, year: data.year, size: data.size, website: web } });
    }

    const { error } = await sb.from("signup_answers").update({
      company: { name: data.name, year: data.year, size: data.size, website: web },
      profile_id: profileId, done_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("user_id", uid);
    if (error) throw new Error(error.message);
    await sb.from("users").update({ status: "Active" }).eq("id", uid);
    return { role: a.role as SignupRole, profileId };
  });

export const dismissWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    await sb.from("signup_answers").update({ welcome_seen_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });
