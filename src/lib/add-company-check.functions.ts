import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidThaiReg } from "@/lib/thai-reg";
import { planAddCheck, type AddAttemptForRetry } from "@/lib/registration-retry";
import type { RegCompany } from "@/lib/signup-reg.functions";

/**
 * + Add My Business / Investor Profile / Firm Profile: sign-up's business questions and company check,
 * without the account steps. The same lookup (reg-lookup.server), the same limits (one number + 2 changes
 * per + Add, and 5 checks a day per device counted with sign-up in signup_reg_checks) and the same
 * "Yes" saving. No profile exists until "Yes": the browser creates the draft only after a found attempt,
 * then applyAddCheck writes every answer, the verified facts and the lock. No Control/Admin exception.
 */
const Kind = z.enum(["seller", "buyer", "advisor"]);
async function admin() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin as any; }

export type AddCheck = { status: "found"; attemptId: string; reg: string; company: RegCompany; changesLeft: number }
  | { status: "not_found"; reg: string; changesLeft: number } | { status: "limit"; why: "changes" | "device" } | { status: "unavailable" };

export const runAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: Kind, reg: z.string().regex(/^\d{13}$/), session: z.string().min(16).max(80), deviceId: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<AddCheck> => {
    if (!isValidThaiReg(data.reg)) throw new Error("This registration number isn't valid. Check the 13 digits.");
    const sb = await admin();
    const { lookupCheck, logAttempt, deviceLimit } = await import("./reg-lookup.server");
    const email = ((context.claims as any)?.email as string | undefined)?.toLowerCase() ?? null;
    const { data: prev } = await sb.from("registration_attempts").select("reg_no, result, held").eq("session_key", data.session).eq("user_id", context.userId).neq("result", "limit");
    const plan = planAddCheck((prev ?? []) as AddAttemptForRetry[], data.reg);
    if (plan.status === "limit") {
      await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "limit" });
      return { status: "limit", why: "changes" };
    }
    // Rejected and not-found numbers reuse this session's server-held result. The retry consumes
    // one change but does not consume the shared device lookup budget or contact the register again.
    if (plan.status === "cached_not_found") {
      await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "not_found" });
      return { status: "not_found", reg: data.reg, changesLeft: plan.changesLeft };
    }
    if (plan.status === "cached_found") {
      const id = await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session,
        result: "pending", company: plan.company, held: plan.held });
      if (!id) throw new Error("Try again.");
      return { status: "found", attemptId: id, reg: data.reg, company: plan.company, changesLeft: plan.changesLeft };
    }
    const lim = await deviceLimit(sb, data.deviceId);
    if (lim.over) {
      await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "limit" });
      return { status: "limit", why: "device" };
    }
    const check = await lookupCheck(data.reg);
    // Register didn't answer: nothing counts, as in sign-up.
    if (check.status === "unavailable") return { status: "unavailable" };
    await sb.from("signup_reg_checks").insert({ user_id: context.userId, email: email ?? "", device_hash: lim.deviceHash, ip_hash: lim.ipHash, reg_no: data.reg, result: check.status });
    if (check.status !== "found") {
      await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "not_found" });
      return { status: "not_found", reg: data.reg, changesLeft: plan.changesLeft };
    }
    // The held result (with the raw register answer) stays server-side until Yes.
    const id = await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "pending", company: check.company, held: { company: check.company, raw: check.raw ?? null } });
    if (!id) throw new Error("Try again.");
    return { status: "found", attemptId: id, reg: data.reg, company: check.company, changesLeft: plan.changesLeft };
  });

/** No keeps the server-held result for a cached retry; leaving the check clears it. */
export const answerAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attemptId: z.string().uuid(), result: z.enum(["no", "cancelled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await sb.from("registration_attempts").update(data.result === "no" ? { result: data.result } : { result: data.result, held: null }).eq("id", data.attemptId).eq("user_id", context.userId).eq("result", "pending");
    return { ok: true };
  });

const Picks = z.object({ types: z.array(z.string().max(30)).max(5), kinds: z.record(z.string().max(20), z.array(z.string().max(30)).max(20)), other: z.array(z.string().max(80)).max(80) });
/** Sign-up's business answers (steps About → Logo), as + Add collected them. */
export const AddAnswers = z.object({
  answer: z.string().max(60),
  types: z.array(z.string().max(60)).max(10),
  company: z.object({ name: z.string().trim().min(2).max(120), size: z.string().max(10).nullable(), website: z.string().trim().max(200).nullable(), country: z.string().max(60) }),
  sector: z.object({ sector: z.string().max(120).nullable().optional(), pick: z.object({ type: z.string().max(30), kind: z.string().max(30).optional() }).nullable().optional(), picks: Picks.nullable().optional(), agnostic: z.boolean().optional() }),
  logo: z.object({ data: z.string().max(3_000_000), type: z.enum(["image/webp", "image/svg+xml", "image/png", "image/jpeg"]) }).nullable(),
});
export type AddAnswersInput = z.infer<typeof AddAnswers>;

const SZ_SELLER: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "More than 500" };
const SZ_BUYER: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "500+" };

/** Yes: after the draft was created, write every + Add answer and the verified facts, lock the number, link the attempts. */
export const applyAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attemptId: z.string().uuid(), kind: Kind, profileId: z.string().uuid(), session: z.string().min(16).max(80), answers: AddAnswers }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: at } = await sb.from("registration_attempts").select("*").eq("id", data.attemptId).eq("user_id", context.userId).maybeSingle();
    if (!at || at.result !== "pending" || at.profile_kind !== data.kind || !at.held) throw new Error("Verify your company first.");
    // The caller must be able to read the new profile as themselves.
    const table = data.kind === "seller" ? "startups" : data.kind === "buyer" ? "investors" : "advisor_firms";
    const { data: mine } = await (context.supabase as any).from(table).select("id").eq("id", data.profileId).maybeSingle();
    if (!mine) throw new Error("Profile not found.");
    const heldAny = at.held as any;
    const co = (heldAny.company ?? heldAny) as RegCompany;
    const raw = heldAny.company ? heldAny.raw : null;
    const reg = at.reg_no as string;
    const ans = data.answers;
    const year = co.regDate ? Number(co.regDate.slice(0, 4)) : null;
    const now = new Date().toISOString();
    const web = ans.company.website ? ans.company.website.replace(/^https?:\/\//i, "").replace(/\/+$/, "") : null;
    const { splitThaiAddress } = await import("./thai-address");
    const { inferThaiPostalCode } = await import("./thai-postal.server");
    const { picksToSectors, normPicks } = await import("./business-types");
    const { uploadHeldLogo, saveDbdAfterYes } = await import("./reg-lookup.server");
    const sp = splitThaiAddress(co.addressTh);
    if (!sp.postal) sp.postal = inferThaiPostalCode({ subdistrict: sp.unit, district: sp.district, province: sp.province }) ?? "";
    const addrEn = co.addressEn ?? null;
    const add = (l: unknown, ...k: string[]) => Array.from(new Set([...(Array.isArray(l) ? l : []), ...k]));
    const parts = { address_line1: sp.street || null, address_line2: null, address_city_district: sp.district || null, address_province_state: sp.province || null, postal_code: sp.postal || null };
    const agn = !!ans.sector.agnostic;
    const p = normPicks(ans.sector.picks);
    const sectors = agn ? [] : picksToSectors(p);
    if (data.kind === "seller") {
      if (!ans.sector.sector?.trim()) throw new Error("Pick what your business does.");
      if (!["owner", "family_owner", "agent"].includes(ans.answer)) throw new Error("Choose whose business it is.");
      const { data: st } = await sb.from("startups").select("setup_from_signup, tenant_id").eq("id", data.profileId).maybeSingle();
      const logoPath = await uploadHeldLogo(sb, ans.logo, (ext) => `${st?.tenant_id}/${data.profileId}/logo-${Date.now()}.${ext}`);
      const { error } = await sb.from("startups").update({
        startup_name: ans.company.name, website_url: web ? `https://${web}` : null, company_size: ans.company.size ? SZ_SELLER[ans.company.size] ?? null : null,
        sector: ans.sector.sector, sector_pick: ans.sector.pick ?? null, ...(logoPath ? { logo_url: logoPath } : {}),
        registered_number: reg, reg_locked_at: now, registered_name: co.nameTh ?? co.nameEn, english_name: co.nameEn ?? null, registered_date: co.regDate ?? co.regDateTh, registered_status: co.statusTh,
        business_address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}), ...parts, ...(sp.province ? { city: sp.province } : {}), year_founded: year,
        setup_from_signup: add(st?.setup_from_signup, "role", "name", ...(web ? ["web"] : []), ...(ans.company.size ? ["size"] : []), "sector", "reg", "year", "address", ...(logoPath ? ["logo"] : [])),
        updated_by: context.userId, updated_at: now,
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
      await sb.from("startup_ownership").update({ seller_relation: ans.answer }).eq("startup_id", data.profileId);
    } else if (data.kind === "buyer") {
      const rel = ans.answer as "individual" | "corporate" | "agent";
      if (!["individual", "corporate", "agent"].includes(rel)) throw new Error("Choose which best describes you.");
      if (!agn && !p.types.length) throw new Error("Pick at least one type of business, or Sector agnostic.");
      const individual = rel === "individual";
      const { data: iv } = await sb.from("investors").select("wizard, tenant_id").eq("id", data.profileId).maybeSingle();
      const w = iv?.wizard ?? {};
      const logoPath = individual ? null : await uploadHeldLogo(sb, ans.logo, (ext) => `${iv?.tenant_id}/${data.profileId}/logo-${Date.now()}.${ext}`);
      const ind = agn ? ["Sector Agnostic"] : sectors;
      const { data: bp } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", context.userId).maybeSingle();
      const extra = bp?.investor_id !== data.profileId;
      const { buyerAddWizardState } = await import("./buyer-wizard");
      const wizardState = buyerAddWizardState(w, { rel, types: ans.types, web, year, size: ans.company.size, sectors: ind, logoPath, extra });
      const { typeVal, ...wizard } = wizardState;
      const { error } = await sb.from("investors").update({
        investor_name: ans.company.name, investor_type: typeVal, acts_for_types: rel === "agent" ? ans.types : [], website_url: web,
        company_size_band: individual ? null : (ans.company.size ? SZ_BUYER[ans.company.size] ?? null : null),
        preferred_industries: ind, sector_picks: agn ? null : p, ...(logoPath ? { logo_url: logoPath } : {}),
        registration_no: reg, reg_locked_at: now, country: "Thailand", address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}), ...parts,
        ...(individual ? {} : { year_founded: year }),
        wizard, updated_by: context.userId, updated_at: now,
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
      // A real buyer account keeps these answers on its one linked buyer_profiles row. Control-only
      // extra profiles have no account, so buyerAddWizardState stores them on that investor instead.
      if (!extra) await sb.from("buyer_profiles").update({ buyer_relation: rel, sectors: ind, ...(logoPath ? { logo_url: logoPath } : {}) }).eq("user_id", context.userId);
    } else {
      if (!agn && !p.types.length) throw new Error("Pick at least one type of business, or Sector agnostic.");
      const team = ans.company.size && /^\d{1,5}$/.test(ans.company.size) ? Number(ans.company.size) : null;
      const { data: f } = await sb.from("advisor_firms").select("wizard_state, setup_answered").eq("id", data.profileId).maybeSingle();
      const ws = f?.wizard_state ?? {};
      const logoPath = await uploadHeldLogo(sb, ans.logo, (ext) => `advisor/${context.userId}/logo-${Date.now()}-add.${ext}`);
      const { error } = await sb.from("advisor_firms").update({
        name: ans.company.name, firm_type: ans.answer, website: web, team_size: team, sectors, sector_agnostic: agn, sector_picks: agn ? null : p,
        ...(logoPath ? { logo_path: logoPath, logo_source: "upload" } : {}),
        registration_no: reg, reg_locked_at: now, country: "Thailand", address_th: co.addressTh, year_founded: year,
        addr_street: sp.street || null, addr_unit: null, addr_district: sp.district || null, addr_province: sp.province || null, addr_postal: sp.postal || null,
        legal_name: co.nameEn ?? co.nameTh, thai_name: co.nameTh, english_name: co.nameEn ?? null, dbd_name: co.nameTh ?? co.nameEn, dbd_status: co.statusTh, dbd_registered_on: co.regDate, dbd_checked_at: now,
        setup_answered: add(f?.setup_answered, "sectors", ...(logoPath ? ["logo"] : [])),
        wizard_state: { ...ws, fromSignup: add(ws.fromSignup, "type", "name", ...(web ? ["web"] : []), ...(team ? ["team"] : []), "sectors", "reg", "year", "address", ...(logoPath ? ["logo"] : [])) },
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
    }
    await saveDbdAfterYes(sb, context.userId, reg, raw);
    await sb.from("registration_attempts").update({ result: "yes", held: null }).eq("id", data.attemptId);
    await sb.from("registration_attempts").update({ profile_id: data.profileId }).eq("session_key", data.session).eq("user_id", context.userId);
    return { ok: true };
  });

/** Contact the PitchSnack team from + Add: sign-up's set-up request, filled in from the signed-in account. */
export const sendAddSetupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    kind: Kind, reason: z.enum(["no_number", "individual", "outside_buyer", "outside_advisor", "check_failed", "too_many"]),
    name: z.string().trim().max(120), email: z.string().trim().max(254), phone: z.string().trim().max(30), company: z.string().max(160).nullable(),
    country: z.string().max(60), note: z.string().max(2000).nullable(), lang: z.enum(["en", "th"]), session: z.string().min(16).max(80).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("contact_enquiries").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many requests. Try again later.");
    const { data: u } = await sb.from("users").select("email, first_name, last_name").eq("id", context.userId).maybeSingle();
    const email = data.email || u?.email || ((context.claims as any)?.email as string) || "";
    const name = data.name || [u?.first_name, u?.last_name].filter(Boolean).join(" ") || email;
    const tried = data.session ? ((await sb.from("registration_attempts").select("reg_no").eq("session_key", data.session).eq("user_id", context.userId)).data ?? []).map((r: any) => r.reg_no) : [];
    const ref = `SU-${Date.now().toString(36).toUpperCase()}`;
    const message = [`+ Add profile set-up request (${data.kind}): ${data.reason}`, `Country: ${data.country}`, data.phone ? `Phone: ${data.phone}` : null, tried.length ? `Registration numbers tried: ${tried.join(", ")}` : null, data.note ? `Note: ${data.note}` : null].filter(Boolean).join("\n");
    const { error } = await sb.from("contact_enquiries").insert({
      reference: ref, role: data.kind === "seller" ? "seller" : data.kind === "buyer" ? "buyer" : "partner", topic: "account", name, company: data.company || null, email,
      message, language: data.lang, consent_at: new Date().toISOString(), user_id: context.userId, setup_reason: data.reason, reg_tried: tried,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The contact form's defaults: name, email and phone from the signed-in account. */
export const getAddContactDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: u } = await (context.supabase as any).from("users").select("email, first_name, last_name").eq("id", context.userId).maybeSingle();
    // Accounts hold no phone number yet; the form asks for it.
    return { name: [u?.first_name, u?.last_name].filter(Boolean).join(" "), email: (u?.email as string) ?? ((context.claims as any)?.email as string) ?? "", phone: "" };
  });
