import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidThaiReg, REG_CHANGES } from "@/lib/thai-reg";
import type { RegCompany } from "@/lib/signup-reg.functions";

/**
 * + Add My Business / Investor Profile / Firm Profile: the same company check as sign-up.
 * No profile exists until "Yes": the browser creates it only after a confirmed attempt,
 * and applyAddCheck writes the verified name, year and address and locks the number.
 * Every account (Control and Admin included) goes through it; there is no skip.
 */
const Kind = z.enum(["seller", "buyer", "advisor"]);
async function admin() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin as any; }

export type AddCheck = { status: "found"; attemptId: string; reg: string; company: RegCompany; changesLeft: number }
  | { status: "not_found"; reg: string; changesLeft: number } | { status: "limit" } | { status: "unavailable" };

export const runAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: Kind, reg: z.string().regex(/^\d{13}$/), session: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data, context }): Promise<AddCheck> => {
    if (!isValidThaiReg(data.reg)) throw new Error("This registration number isn't valid. Check the 13 digits.");
    const sb = await admin();
    const { data: prev } = await sb.from("registration_attempts").select("reg_no, result").eq("session_key", data.session).eq("user_id", context.userId);
    const numbers = new Set<string>((prev ?? []).map((r: any) => r.reg_no));
    const isNew = !numbers.has(data.reg);
    // One number plus two changes per profile.
    if (isNew && numbers.size >= 1 + REG_CHANGES) {
      const { logAttempt } = await import("./reg-lookup.server");
      await logAttempt(sb, { reg: data.reg, userId: context.userId, source: "add", kind: data.kind, session: data.session, result: "limit" });
      return { status: "limit" };
    }
    const used = numbers.size + (isNew ? 1 : 0);
    const changesLeft = Math.max(0, 1 + REG_CHANGES - used);
    const { lookupCheck, logAttempt } = await import("./reg-lookup.server");
    const check = await lookupCheck(data.reg);
    if (check.status === "unavailable") return { status: "unavailable" };
    const email = ((context.claims as any)?.email as string | undefined) ?? null;
    if (check.status !== "found") {
      await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "not_found" });
      return { status: "not_found", reg: data.reg, changesLeft };
    }
    const id = await logAttempt(sb, { reg: data.reg, userId: context.userId, email, source: "add", kind: data.kind, session: data.session, result: "pending", company: check.company, held: check.company });
    if (!id) throw new Error("Try again.");
    return { status: "found", attemptId: id, reg: data.reg, company: check.company, changesLeft };
  });

/** No, or leaving the check: the attempt is answered; nothing about the company is kept. */
export const answerAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attemptId: z.string().uuid(), result: z.enum(["no", "cancelled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await sb.from("registration_attempts").update({ result: data.result, held: null }).eq("id", data.attemptId).eq("user_id", context.userId).eq("result", "pending");
    return { ok: true };
  });

/** Yes: after the profile was created, write the verified facts, lock the number and link the attempts. */
export const applyAddCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attemptId: z.string().uuid(), kind: Kind, profileId: z.string().uuid(), name: z.string().trim().min(2).max(120), session: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: at } = await sb.from("registration_attempts").select("*").eq("id", data.attemptId).eq("user_id", context.userId).maybeSingle();
    if (!at || at.result !== "pending" || at.profile_kind !== data.kind || !at.held) throw new Error("Verify your company first.");
    // The caller must be able to read the new profile as themselves.
    const table = data.kind === "seller" ? "startups" : data.kind === "buyer" ? "investors" : "advisor_firms";
    const { data: mine } = await (context.supabase as any).from(table).select("id").eq("id", data.profileId).maybeSingle();
    if (!mine) throw new Error("Profile not found.");
    const co = at.held as RegCompany;
    const reg = at.reg_no as string;
    const year = co.regDate ? Number(co.regDate.slice(0, 4)) : null;
    const now = new Date().toISOString();
    const { splitThaiAddress } = await import("./thai-address");
    const sp = splitThaiAddress(co.addressTh);
    const addrEn = co.addressEn ?? null;
    const add = (l: unknown, ...k: string[]) => Array.from(new Set([...(Array.isArray(l) ? l : []), ...k]));
    const parts = { address_line1: sp.street || null, address_line2: sp.unit || null, address_city_district: sp.district || null, address_province_state: sp.province || null, postal_code: sp.postal || null };
    if (data.kind === "seller") {
      const { data: st } = await sb.from("startups").select("setup_from_signup").eq("id", data.profileId).maybeSingle();
      const { error } = await sb.from("startups").update({
        startup_name: data.name, registered_number: reg, reg_locked_at: now, registered_name: co.nameTh ?? co.nameEn, registered_date: co.regDate ?? co.regDateTh, registered_status: co.statusTh,
        business_address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}), ...parts, ...(sp.province ? { city: sp.province } : {}), year_founded: year,
        setup_from_signup: add(st?.setup_from_signup, "reg", "year", "address"), updated_at: now,
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
    } else if (data.kind === "buyer") {
      const { data: iv } = await sb.from("investors").select("wizard").eq("id", data.profileId).maybeSingle();
      const w = iv?.wizard ?? {};
      const { error } = await sb.from("investors").update({
        investor_name: data.name, registration_no: reg, reg_locked_at: now, country: "Thailand", address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}), ...parts,
        year_founded: year, wizard: { ...w, from_signup: add(w.from_signup, "name", "reg", "year", "address") }, updated_at: now,
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
    } else {
      const { data: f } = await sb.from("advisor_firms").select("wizard_state").eq("id", data.profileId).maybeSingle();
      const ws = f?.wizard_state ?? {};
      const { error } = await sb.from("advisor_firms").update({
        name: data.name, registration_no: reg, reg_locked_at: now, country: "Thailand", address_th: co.addressTh, year_founded: year,
        addr_street: sp.street || null, addr_unit: sp.unit || null, addr_district: sp.district || null, addr_province: sp.province || null, addr_postal: sp.postal || null,
        legal_name: co.nameEn ?? co.nameTh, thai_name: co.nameTh, dbd_name: co.nameTh ?? co.nameEn, dbd_status: co.statusTh, dbd_registered_on: co.regDate, dbd_checked_at: now,
        wizard_state: { ...ws, fromSignup: add(ws.fromSignup, "name", "reg", "year", "address") },
      }).eq("id", data.profileId);
      if (error) throw new Error(error.message);
    }
    await sb.from("registration_attempts").update({ result: "yes", held: null }).eq("id", data.attemptId);
    await sb.from("registration_attempts").update({ profile_id: data.profileId }).eq("session_key", data.session).eq("user_id", context.userId);
    return { ok: true };
  });

/** No Thai registration number: a set-up request to the PitchSnack team, filled in from the signed-in account. */
export const sendAddSetupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: Kind, reason: z.enum(["foreign", "individual", "other"]), company: z.string().max(120), lang: z.enum(["en", "th"]), session: z.string().min(16).max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("contact_enquiries").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many requests. Try again later.");
    const { data: u } = await sb.from("users").select("email, first_name, last_name").eq("id", context.userId).maybeSingle();
    const email = u?.email ?? ((context.claims as any)?.email as string) ?? "";
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || email;
    const tried = data.session ? ((await sb.from("registration_attempts").select("reg_no").eq("session_key", data.session).eq("user_id", context.userId)).data ?? []).map((r: any) => r.reg_no) : [];
    const ref = `SU-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await sb.from("contact_enquiries").insert({
      reference: ref, role: data.kind === "seller" ? "seller" : data.kind === "buyer" ? "buyer" : "partner", topic: "account", name, company: data.company || null, email,
      message: `+ Add profile without a Thai registration number (${data.kind}).`, language: data.lang, consent_at: new Date().toISOString(), user_id: context.userId, setup_reason: data.reason, reg_tried: tried,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
