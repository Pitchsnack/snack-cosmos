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
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const uid = context.userId;
    // Setup language: set once, from the sign-up page's language; a DB trigger keeps it from changing later.
    if (data.lang) await sb.from("users").update({ setup_language: data.lang }).eq("id", uid).is("setup_language", null);
    const { data: u } = await sb.auth.admin.getUserById(uid);
    if (!u?.user?.email_confirmed_at) throw new Error("Confirm your email first.");
    const { data: a } = await sb.from("signup_answers").select("*").eq("user_id", uid).maybeSingle();
    // Soft launch: while the gate is on, a new account gets its role only after claim-access-seat linked it to a code.
    const { data: gate } = await sb.from("soft_launch_settings").select("gate_on,changed_at").eq("id", true).maybeSingle();
    const { data: cur } = await sb.from("users").select("account_role,access_code_id").eq("id", uid).maybeSingle();
    if (gate?.gate_on && !cur?.account_role && !cur?.access_code_id && Date.parse(u.user.created_at) >= Date.parse(gate.changed_at)) {
      throw new Error("New accounts need the code from your invitation.");
    }
    // One role per account, from the role step; new sellers start on the Entry plan (from the plans table).
    if (a && ["seller", "buyer", "advisor"].includes(a.role)) {
      if (!cur?.account_role) await sb.from("users").update({ account_role: a.role }).eq("id", uid);
      if (a.role === "seller") {
        const { data: entry } = await sb.from("plans").select("id, term_months").eq("role", "seller").eq("status", "live").order("sort").limit(1).maybeSingle();
        if (entry) {
          const end = new Date(); end.setMonth(end.getMonth() + entry.term_months);
          await sb.from("subscriptions").upsert({ user_id: uid, plan_id: entry.id, term_end: end.toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });
        }
      }
    }
    if (!a) throw new Error("Sign-up answers not found.");
    const y = data.year ? Number(data.year) : null;
    if (y != null && (y < 1800 || y > new Date().getFullYear())) throw new Error("Invalid year.");
    const web = data.website ? data.website.replace(/^https?:\/\//i, "").replace(/\/+$/, "") : null;
    if (a.done_at) {
      // Back from the last step: Continue saves any change to the Draft made earlier.
      const pid = a.profile_id as string | null;
      const { data: me2 } = await sb.from("users").select("signup_done_at").eq("id", uid).maybeSingle();
      if (pid && !me2?.signup_done_at) {
        const now = new Date().toISOString();
        if (a.role === "seller") {
          const SZ: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "More than 500" };
          await sb.from("startups").update({ startup_name: data.name, website_url: web, year_founded: y, company_size: data.size ? SZ[data.size] ?? null : null, updated_by: uid, updated_at: now }).eq("id", pid).eq("created_by", uid);
        } else if (a.role === "buyer") {
          const individual = a.buyer_relation === "individual";
          await sb.from("investors").update({ investor_name: data.name, website_url: web, year_founded: individual ? null : y, company_size_band: individual ? null : (data.size ? SIZE_TO_BUYER[data.size] ?? null : null), updated_by: uid, updated_at: now }).eq("id", pid);
        } else if (a.role === "advisor") {
          const team = data.size && /^\d{1,5}$/.test(data.size) ? Number(data.size) : null;
          await sb.from("advisor_firms").update({ name: data.name, website: web, year_founded: y, team_size: team }).eq("id", pid).eq("owner_user_id", uid);
        }
        await sb.from("signup_answers").update({ company: { name: data.name, year: data.year, size: data.size, website: web }, updated_at: now }).eq("user_id", uid);
      }
      return { role: a.role as SignupRole, profileId: pid };
    }
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
      // New sign-ups store buyer_relation + types; older ones stored the investor type as the first answer.
      const rel: string | null = a.buyer_relation ?? (a.first_answer === INDIVIDUAL_TYPE ? "individual" : null);
      const types: string[] = a.buyer_relation ? (a.investor_types ?? []) : [a.first_answer];
      const individual = rel === "individual";
      const agent = rel === "agent";
      const typeVal = individual ? INDIVIDUAL_TYPE : types[0] ?? null;
      const fromSignup = individual ? ["role", "name", ...(web ? ["web"] : [])]
        : [...(rel ? ["role"] : []), ...(typeVal ? ["type"] : []), "name", ...(web ? ["web"] : []), ...(y ? ["year"] : []), ...(data.size ? ["size"] : [])];
      const answered = individual ? ["role"] : [...(rel ? ["role"] : []), ...(typeVal ? ["type"] : [])];
      const { error } = await sb.from("investors").update({
        investor_name: data.name, investor_type: typeVal, acts_for_types: agent ? types : [], website_url: web,
        year_founded: individual ? null : y,
        company_size_band: individual ? null : (data.size ? SIZE_TO_BUYER[data.size] ?? null : null),
        wizard: { answered, from_signup: fromSignup },
        updated_by: uid, updated_at: new Date().toISOString(),
      }).eq("id", investorId);
      if (error) throw new Error(error.message);
      if (rel) await sb.from("buyer_profiles").update({ buyer_relation: rel }).eq("user_id", uid);
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
    // Sign-up finishes at the last step (saveSignupSector) or once the profile gets a sector answer elsewhere.
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
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const uid = context.userId;
    const { data: a } = await sb.from("signup_answers").select("role, profile_id, done_at").eq("user_id", uid).maybeSingle();
    if (!a?.done_at || !a.profile_id) throw new Error("Finish Your company first.");
    const { picksToSectors, normPicks } = await import("@/lib/business-types");
    const add = (l: unknown, k: string) => Array.from(new Set([...(Array.isArray(l) ? l : []), k]));
    const now = new Date().toISOString();
    if (a.role === "seller") {
      if (!data.sector?.trim()) throw new Error("Pick what your business does.");
      const { data: st } = await sb.from("startups").select("setup_from_signup").eq("id", a.profile_id).eq("created_by", uid).maybeSingle();
      if (!st) throw new Error("Draft not found.");
      const { error } = await sb.from("startups").update({
        sector: data.sector, sector_pick: data.pick ?? null, setup_from_signup: add(st.setup_from_signup, "sector"), updated_by: uid, updated_at: now,
      }).eq("id", a.profile_id);
      if (error) throw new Error(error.message);
    } else {
      const agn = !!data.agnostic;
      const p = normPicks(data.picks);
      if (!agn && (!p.types.length || (p.types.includes("other" as never) && !p.other.length))) throw new Error("Pick at least one type of business, or Sector agnostic.");
      const sectors = agn ? [] : picksToSectors(p);
      if (a.role === "buyer") {
        const { data: iv } = await sb.from("investors").select("wizard").eq("id", a.profile_id).maybeSingle();
        if (!iv) throw new Error("Draft not found.");
        const w = iv.wizard ?? {};
        const ind = agn ? ["Sector Agnostic"] : sectors;
        const { error } = await sb.from("investors").update({
          preferred_industries: ind, sector_picks: agn ? null : p,
          wizard: { ...w, answered: add(w.answered, "sectors"), from_signup: add(w.from_signup, "sectors") }, updated_by: uid, updated_at: now,
        }).eq("id", a.profile_id);
        if (error) throw new Error(error.message);
        await sb.from("buyer_profiles").update({ sectors: ind }).eq("user_id", uid);
      } else {
        const { data: f } = await sb.from("advisor_firms").select("wizard_state, setup_answered").eq("id", a.profile_id).eq("owner_user_id", uid).maybeSingle();
        if (!f) throw new Error("Draft not found.");
        const ws = f.wizard_state ?? {};
        const { error } = await sb.from("advisor_firms").update({
          sectors, sector_agnostic: agn, sector_picks: agn ? null : p,
          setup_answered: add(f.setup_answered, "sectors"), wizard_state: { ...ws, fromSignup: add(ws.fromSignup, "sectors") },
        }).eq("id", a.profile_id);
        if (error) throw new Error(error.message);
      }
    }
    await sb.from("users").update({ signup_done_at: now }).eq("id", uid).is("signup_done_at", null);
    return { role: a.role as SignupRole };
  });
