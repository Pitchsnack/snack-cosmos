/** Sign-up profile writes shared by the sign-up server functions. Service client, always scoped to a verified user. */
import { INDIVIDUAL_TYPE, sortActsFor } from "@/lib/investor-bands";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const SIZE_TO_BUYER: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "500+" };
export type SignupRole = "seller" | "buyer" | "advisor";

export type FinishInput = { name: string; year: string | null; size: string | null; website: string | null; lang?: "en" | "th" };
/** Makes (or updates) the Draft profile from the sign-up answers. Server-only; caller is verified. */
export async function doFinish(uid: string, data: FinishInput) {
    const sb = await admin();
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
    // Contact defaults from the account: sign-in email and the name typed at sign-up (changeable later).
    const acctEmail = u.user.email ?? null;
    const acctName = [a.first_name, a.last_name].map((x: string | null) => (x ?? "").trim()).filter(Boolean).join(" ") || null;

    // `fromSignup` lists the fields sign-up answered; the setup wizards hide them while they still hold a value.
    if (a.role === "advisor") {
      const team = data.size && /^\d{1,5}$/.test(data.size) ? Number(data.size) : null;
      const fromSignup = ["type", "name", ...(web ? ["web"] : []), ...(y ? ["year"] : []), ...(team ? ["team"] : [])];
      await sb.from("users").update({ advisor_view: true }).eq("id", uid);
      const { data: f, error } = await sb.from("advisor_firms").insert({
        owner_user_id: uid, status: "draft", name: data.name, firm_type: a.first_answer, country: "Thailand",
        website: web, year_founded: y, team_size: team, setup_answered: [], wizard_state: { fromSignup },
        email: acctEmail, contact_name: acctName,
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
      if (acctEmail) await sb.from("investors").update({ email: acctEmail }).eq("id", investorId).is("email", null);
      // A firm's first Team member starts as the person who signed up; individuals are the profile themselves.
      if (!individual && acctName) {
        const { data: bp } = await sb.from("buyer_profiles").select("people").eq("user_id", uid).maybeSingle();
        if (bp && !(Array.isArray(bp.people) && bp.people.length)) await sb.from("buyer_profiles").update({ people: [{ name: acctName, role: "", email: acctEmail ?? "", phone: "" }] }).eq("user_id", uid);
      }
      profileId = investorId;
    } else if (a.role === "seller") {
      const { ensureSellerDraftFromSignup } = await import("@/lib/seller-setup.server");
      profileId = await ensureSellerDraftFromSignup(sb, uid, { ...a, profile_id: null, company: { name: data.name, year: data.year, size: data.size, website: web } });
      if (profileId) {
        if (acctEmail) await sb.from("startups").update({ email: acctEmail }).eq("id", profileId).is("email", null);
        // The person who signed up becomes the first founder (name only; position left to fill in).
        if (acctName) {
          const { data: st } = await sb.from("startups").select("tenant_id").eq("id", profileId).maybeSingle();
          const { count } = await sb.from("startup_founders").select("id", { count: "exact", head: true }).eq("startup_id", profileId);
          if (st && !count) await sb.from("startup_founders").insert({ startup_id: profileId, tenant_id: st.tenant_id, full_name: acctName, display_order: 0 });
        }
      }
    }

    const { error } = await sb.from("signup_answers").update({
      company: { name: data.name, year: data.year, size: data.size, website: web },
      profile_id: profileId, done_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("user_id", uid);
    if (error) throw new Error(error.message);
    // Sign-up finishes at the last step (saveSignupSector) or once the profile gets a sector answer elsewhere.
    await sb.from("users").update({ status: "Active" }).eq("id", uid);
    return { role: a.role as SignupRole, profileId };
  }

export type SectorInput = { sector?: string | null; pick?: { type: string; kind?: string } | null; picks?: { types: string[]; kinds: Record<string, string[]>; other: string[] } | null; agnostic?: boolean };
/** Saves the sector answer to the Draft and finishes sign-up. Server-only. */
export async function doSaveSector(uid: string, data: SectorInput) {
    const sb = await admin();
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
  }
