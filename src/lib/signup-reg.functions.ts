import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidThaiReg, REG_CHANGES } from "@/lib/thai-reg";

/**
 * Sign-up company check (section 9). The account stays a pending sign-up — no role,
 * no profile — until the user presses "Yes, this is my company". Lookups run only
 * here, only after the email is confirmed, and within the per-email/per-device limits.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type RegCompany = {
  nameTh: string | null; nameEn: string | null; regDate: string | null; regDateTh: string | null;
  addressTh: string | null; addressEn: string | null; translated: boolean; statusTh: string | null; active: boolean;
};
export type RegCheck =
  | { status: "found"; reg: string; company: RegCompany }
  | { status: "not_found"; reg: string }
  | { status: "rejected"; reg: string }
  | { status: "limit" }
  | { status: "unavailable" }
  | { status: "running"; reg: string };
export type RegState = {
  confirmed: boolean; registered: boolean; reg: string | null; changes: number; tried: string[];
  check: RegCheck | null; pending: PendingPayload | null; email: string;
};

const Picks = z.object({ types: z.array(z.string().max(30)).max(5), kinds: z.record(z.string().max(20), z.array(z.string().max(30)).max(20)), other: z.array(z.string().max(80)).max(80) });
const Pending = z.object({
  company: z.object({ name: z.string().trim().min(2).max(120), size: z.string().max(10).nullable(), website: z.string().trim().max(200).nullable(), country: z.string().max(60) }),
  reg: z.string().regex(/^\d{13}$/),
  sector: z.object({ sector: z.string().max(120).nullable().optional(), pick: z.object({ type: z.string().max(30), kind: z.string().max(30).optional() }).nullable().optional(), picks: Picks.nullable().optional(), agnostic: z.boolean().optional() }),
  // Already converted in the browser (WebP ≤ 800px, or a cleaned SVG), as a data URL.
  logo: z.object({ data: z.string().max(3_000_000), type: z.enum(["image/webp", "image/svg+xml", "image/png", "image/jpeg"]) }).nullable(),
  lang: z.enum(["en", "th"]),
});
export type PendingPayload = z.infer<typeof Pending>;

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const getRegState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegState> => {
    const sb = await admin();
    const [{ data: u }, { data: a }] = await Promise.all([
      sb.auth.admin.getUserById(context.userId),
      sb.from("signup_answers").select("pending, reg_no, reg_changes, reg_tried, reg_check, registered_at").eq("user_id", context.userId).maybeSingle(),
    ]);
    const chk = a?.reg_check ? ({ ...a.reg_check, raw: undefined } as RegCheck) : null;
    return {
      confirmed: !!u?.user?.email_confirmed_at, registered: !!a?.registered_at, reg: a?.reg_no ?? null,
      changes: a?.reg_changes ?? 0, tried: a?.reg_tried ?? [], check: chk, pending: a?.pending ?? null, email: u?.user?.email ?? "",
    };
  });

/** Create account / Google / Microsoft: the held answers move to the pending sign-up. */
export const savePendingSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Pending.parse(d))
  .handler(async ({ data, context }) => {
    if (!isValidThaiReg(data.reg)) throw new Error("This registration number isn't valid.");
    const sb = await admin();
    const { data: a } = await sb.from("signup_answers").select("registered_at, reg_no").eq("user_id", context.userId).maybeSingle();
    if (!a) throw new Error("Sign-up answers not found.");
    if (a.registered_at) return { ok: true };
    // The number is fixed once held; later changes go through the correction step only.
    await sb.from("signup_answers").update({ pending: data, reg_no: a.reg_no ?? data.reg, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });

function companyFrom(outcome: any): RegCompany {
  const ci = outcome?.company?.companyInfo ?? {};
  const st: string | null = ci.legalEntityStatusTh ?? outcome?.company?.profile?.status ?? null;
  return {
    nameTh: ci.legalNameTh ?? null, nameEn: ci.legalNameEn ?? outcome?.company?.registeredName ?? null,
    regDate: ci.registrationDate ?? null, regDateTh: ci.registrationDateThRaw ?? null,
    addressTh: ci.headOfficeAddressTh ?? null, addressEn: null, translated: false,
    statusTh: st, active: !!st && /ยังดำเนินกิจการอยู่|active/i.test(st),
  };
}

async function translateAddress(th: string): Promise<string | null> {
  try {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const res: any = await generateResponse({
      model: "openai/gpt-6.1-terra",
      instructions: "Translate the Thai postal address into a standard English postal address. Reply with the address only, on one line.",
      input: th,
    });
    const text = (res.output ?? []).flatMap((o: any) => (o.type === "message" ? o.content : [])).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("").trim();
    return text || null;
  } catch { return null; }
}

async function deviceLimit(sb: any, deviceId: string) {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const deviceHash = await sha(`d:${deviceId}`);
  const ipHash = ip ? await sha(`i:${ip}`) : null;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await sb.from("signup_reg_checks").select("id", { count: "exact", head: true }).gte("created_at", since).neq("result", "unavailable")
    .or(ipHash ? `device_hash.eq.${deviceHash},ip_hash.eq.${ipHash}` : `device_hash.eq.${deviceHash}`);
  return { over: (count ?? 0) >= 5, deviceHash, ipHash };
}

/** One register lookup; the held check keeps `raw` server-side only. */
async function lookupCheck(reg: string): Promise<any> {
  const { lookupDbdFinancials } = await import("./financials/dbd-provider.server");
  let outcome: any;
  try { outcome = await lookupDbdFinancials({ registeredNumber: reg }); }
  catch (e: any) { outcome = { status: "unavailable", detail: String(e?.message ?? e) }; }
  const found = outcome.status === "ok" || outcome.status === "no_financials";
  if (found) {
    const company = companyFrom(outcome);
    if (company.addressTh && !company.addressEn) {
      const en = await translateAddress(company.addressTh);
      if (en) { company.addressEn = en; company.translated = true; }
    }
    return { status: "found", reg, company, raw: outcome };
  }
  return outcome.status === "not_found" ? { status: "not_found", reg } : { status: "unavailable" };
}

const PRE_STALE_MS = 4 * 60_000;

/**
 * Continue on Your company → "Confirm and continue": the check starts on the server while the
 * visitor fills in the next steps. Keyed by a random id kept in the browser; the result is held
 * server-side and never returned here (company details only after the email is confirmed).
 */
export const startRegPrecheck = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(80), deviceId: z.string().min(8).max(80), reg: z.string().regex(/^\d{13}$/) }).parse(d))
  .handler(async ({ data }): Promise<{ status: "running" | "done" }> => {
    if (!isValidThaiReg(data.reg)) throw new Error("This registration number isn't valid.");
    const sb = await admin();
    // Abandoned sign-ups: held results are discarded.
    await sb.from("signup_reg_prechecks").delete().lt("created_at", new Date(Date.now() - 2 * 3600_000).toISOString());
    const tokenHash = await sha(`p:${data.token}`);
    const { data: cur } = await sb.from("signup_reg_prechecks").select("id, reg_no, status, created_at").eq("token_hash", tokenHash).maybeSingle();
    if (cur && cur.reg_no === data.reg && (cur.status === "done" || Date.now() - Date.parse(cur.created_at) < PRE_STALE_MS)) return { status: cur.status };
    if (cur) await sb.from("signup_reg_prechecks").delete().eq("id", cur.id);
    const lim = await deviceLimit(sb, data.deviceId);
    if (lim.over) {
      await sb.from("signup_reg_prechecks").insert({ token_hash: tokenHash, reg_no: data.reg, status: "done", result: { status: "limit" }, done_at: new Date().toISOString() });
      return { status: "done" };
    }
    // Counts against the sign-up and the device when it starts; the email is added once known.
    const { data: row } = await sb.from("signup_reg_checks").insert({ email: "", device_hash: lim.deviceHash, ip_hash: lim.ipHash, reg_no: data.reg, result: "running" }).select("id").single();
    const { data: pre, error } = await sb.from("signup_reg_prechecks").insert({ token_hash: tokenHash, reg_no: data.reg, check_row_id: row?.id ?? null }).select("id").single();
    if (error || !pre) return { status: "running" };
    const check = await lookupCheck(data.reg);
    const result = check.status;
    if (row?.id) {
      if (result === "unavailable") await sb.from("signup_reg_checks").delete().eq("id", row.id);
      else await sb.from("signup_reg_checks").update({ result }).eq("id", row.id);
    }
    await sb.from("signup_reg_prechecks").update({ status: "done", result: check, done_at: new Date().toISOString() }).eq("id", pre.id);
    return { status: "done" };
  });

/** Runs the check for the held number, or for a corrected number (`newReg`). */
export const runRegCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deviceId: z.string().min(8).max(80), newReg: z.string().regex(/^\d{13}$/).optional(), pre: z.string().min(16).max(80).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<RegCheck> => {
    const sb = await admin();
    const uid = context.userId;
    const { data: u } = await sb.auth.admin.getUserById(uid);
    if (!u?.user?.email_confirmed_at) throw new Error("Confirm your email first.");
    const email = String(u.user.email ?? "").toLowerCase();
    const { data: a } = await sb.from("signup_answers").select("reg_no, reg_changes, reg_tried, reg_check, registered_at").eq("user_id", uid).maybeSingle();
    if (!a?.reg_no) throw new Error("Sign-up answers not found.");
    if (a.registered_at) throw new Error("Your account is already registered.");
    let reg: string = a.reg_no;
    let changes: number = a.reg_changes ?? 0;
    const held = a.reg_check as any;
    if (data.newReg) {
      if (!held || !["not_found", "rejected"].includes(held.status)) throw new Error("Nothing to correct.");
      if (changes >= REG_CHANGES) throw new Error("You've used both changes.");
      if (data.newReg === a.reg_no) throw new Error("Change the registration number.");
      reg = data.newReg; changes += 1;
    } else if (held?.status === "found" && held.reg === reg) {
      return { status: "found", reg, company: held.company };   // reopen from the held result, no new lookup
    } else if (held && held.reg === reg && ["not_found", "rejected"].includes(held.status)) {
      return { status: held.status, reg } as RegCheck;
    }
    if (!isValidThaiReg(reg)) throw new Error("This registration number isn't valid.");

    // A check already started in the background for this number.
    let check: any = null;
    if (!data.newReg && data.pre) {
      const { data: pre } = await sb.from("signup_reg_prechecks").select("id, reg_no, status, result, check_row_id, created_at").eq("token_hash", await sha(`p:${data.pre}`)).maybeSingle();
      if (pre && pre.reg_no === reg) {
        if (pre.status === "running" && Date.now() - Date.parse(pre.created_at) < PRE_STALE_MS) return { status: "running", reg };
        const r = pre.status === "done" ? pre.result : null;
        if (r && r.status !== "unavailable") {
          // The email is known now: count the check against it; over 3, the result isn't shown.
          const q = sb.from("signup_reg_checks").select("id", { count: "exact", head: true }).eq("email", email).neq("result", "unavailable");
          const { count } = await (pre.check_row_id ? q.neq("id", pre.check_row_id) : q);
          if (pre.check_row_id) await sb.from("signup_reg_checks").update({ email, user_id: uid }).eq("id", pre.check_row_id);
          await sb.from("signup_reg_prechecks").delete().eq("id", pre.id);
          if (r.status === "limit" || (count ?? 0) >= 3) return { status: "limit" };
          check = r;
        } else await sb.from("signup_reg_prechecks").delete().eq("id", pre.id);
      }
    }

    if (!check) {
      // Limits, before any lookup: 3 per email (all sign-ups), 5 per device in any 24 hours.
      const [lim, { count: byEmail }] = await Promise.all([
        deviceLimit(sb, data.deviceId),
        sb.from("signup_reg_checks").select("id", { count: "exact", head: true }).eq("email", email).neq("result", "unavailable"),
      ]);
      if ((byEmail ?? 0) >= 3 || lim.over) return { status: "limit" };
      check = await lookupCheck(reg);
      await sb.from("signup_reg_checks").insert({ user_id: uid, email, device_hash: lim.deviceHash, ip_hash: lim.ipHash, reg_no: reg, result: check.status });
      // Register didn't answer: nothing counts, nothing changes; the user may try again.
      if (check.status === "unavailable") return { status: "unavailable" };
    }
    const found = check.status === "found";
    const tried = Array.from(new Set([...(a.reg_tried ?? []), reg]));
    await sb.from("signup_answers").update({ reg_no: reg, reg_changes: changes, reg_tried: tried, reg_check: check, updated_at: new Date().toISOString() }).eq("user_id", uid);
    return found ? { status: "found", reg, company: check.company } : { status: "not_found", reg };
  });

/** "No, this isn't my company": nothing about that company is kept. */
export const rejectRegCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: a } = await sb.from("signup_answers").select("reg_no, reg_check, registered_at").eq("user_id", context.userId).maybeSingle();
    if (!a || a.registered_at || a.reg_check?.status !== "found") throw new Error("Nothing to answer.");
    await sb.from("signup_answers").update({ reg_check: { status: "rejected", reg: a.reg_no }, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { ok: true };
  });

const SZ_SELLER: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "More than 500" };
const add = (l: unknown, ...k: string[]) => Array.from(new Set([...(Array.isArray(l) ? l : []), ...k]));

/** "Yes, this is my company": registers the account in one server step (section 9). */
export const confirmRegCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const uid = context.userId;
    const { data: a } = await sb.from("signup_answers").select("*").eq("user_id", uid).maybeSingle();
    if (!a) throw new Error("Sign-up answers not found.");
    if (a.registered_at) return { role: a.role as "seller" | "buyer" | "advisor", firstName: a.first_name as string | null };
    const chk = a.reg_check as any;
    const p = a.pending as PendingPayload | null;
    if (chk?.status !== "found" || chk.reg !== a.reg_no || !p) throw new Error("Verify your company first.");
    const co: RegCompany = chk.company;
    const year = co.regDate ? co.regDate.slice(0, 4) : null;

    const { doFinish, doSaveSector } = await import("./signup-core.server");
    const fin = await doFinish(uid, { name: p.company.name, year, size: p.company.size, website: p.company.website, lang: p.lang });
    const pid = fin.profileId;
    if (!pid) throw new Error("Draft not created.");
    await doSaveSector(uid, p.sector as never);

    // Logo, uploaded now to the same place the setup wizard saves it.
    let logoPath: string | null = null;
    if (p.logo) {
      const m = /^data:([^;]+);base64,(.+)$/.exec(p.logo.data);
      if (m) {
        const bytes = Uint8Array.from(atob(m[2]!), (ch) => ch.charCodeAt(0));
        if (bytes.byteLength <= 2 * 1024 * 1024) {
          const ext = p.logo.type === "image/svg+xml" ? "svg" : p.logo.type === "image/png" ? "png" : p.logo.type === "image/jpeg" ? "jpg" : "webp";
          let path: string;
          if (a.role === "advisor") path = `advisor/${uid}/logo-${Date.now()}-signup.${ext}`;
          else {
            const t = a.role === "seller" ? await sb.from("startups").select("tenant_id").eq("id", pid).maybeSingle() : await sb.from("investors").select("tenant_id").eq("id", pid).maybeSingle();
            path = `${t.data?.tenant_id}/${pid}/logo-${Date.now()}.${ext}`;
          }
          const { error } = await sb.storage.from("startup-media").upload(path, bytes, { contentType: p.logo.type, upsert: true });
          if (!error) logoPath = path;
        }
      }
    }

    const now = new Date().toISOString();
    const addrEn = co.addressEn ?? null;
    if (a.role === "seller") {
      const { data: st } = await sb.from("startups").select("setup_from_signup").eq("id", pid).maybeSingle();
      await sb.from("startups").update({
        registered_number: a.reg_no, reg_locked_at: now, registered_name: co.nameTh ?? co.nameEn, registered_date: co.regDate ?? co.regDateTh, registered_status: co.statusTh,
        business_address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}), year_founded: year ? Number(year) : null,
        company_size: p.company.size ? SZ_SELLER[p.company.size] ?? null : null, ...(logoPath ? { logo_url: logoPath } : {}),
        setup_from_signup: add(st?.setup_from_signup, "reg", "year", "size", "sector", "address", ...(logoPath ? ["logo"] : [])), updated_at: now,
      }).eq("id", pid);
    } else if (a.role === "buyer") {
      const { data: iv } = await sb.from("investors").select("wizard").eq("id", pid).maybeSingle();
      const w = iv?.wizard ?? {};
      await sb.from("investors").update({
        registration_no: a.reg_no, reg_locked_at: now, country: p.company.country, address_th: co.addressTh, ...(addrEn ? { business_address: addrEn } : {}),
        ...(a.buyer_relation === "individual" ? {} : { year_founded: year ? Number(year) : null }), ...(logoPath ? { logo_url: logoPath } : {}),
        wizard: { ...w, from_signup: add(w.from_signup, "reg", "year", "address", ...(logoPath ? ["logo"] : [])) }, updated_at: now,
      }).eq("id", pid);
      if (logoPath) await sb.from("buyer_profiles").update({ logo_url: logoPath }).eq("user_id", uid);
    } else {
      const { data: f } = await sb.from("advisor_firms").select("wizard_state, setup_answered").eq("id", pid).maybeSingle();
      const ws = f?.wizard_state ?? {};
      await sb.from("advisor_firms").update({
        registration_no: a.reg_no, reg_locked_at: now, country: p.company.country, address_th: co.addressTh, year_founded: year ? Number(year) : null,
        legal_name: co.nameEn ?? co.nameTh, thai_name: co.nameTh, dbd_name: co.nameTh ?? co.nameEn, dbd_status: co.statusTh, dbd_registered_on: co.regDate, dbd_checked_at: now,
        ...(logoPath ? { logo_path: logoPath, logo_source: "upload" } : {}),
        setup_answered: add(f?.setup_answered, ...(logoPath ? ["logo"] : [])),
        wizard_state: { ...ws, fromSignup: add(ws.fromSignup, "reg", "year", "address", ...(logoPath ? ["logo"] : [])) },
      }).eq("id", pid);
    }

    // The company's one fetch, stored under the confirmed number (as Extract data does).
    try {
      const { outcomeToData } = await import("./dbd-store.server");
      await sb.rpc("dbd_store_save_signup", { _user: uid, _reg: a.reg_no, _data: outcomeToData(chk.raw), _raw: chk.raw });
    } catch (e) { console.error("signup dbd store", e); }

    await sb.from("signup_answers").update({ registered_at: now, pending: null, reg_check: { status: "found", reg: a.reg_no, company: co }, welcome_seen_at: null, updated_at: now }).eq("user_id", uid);
    return { role: a.role as "seller" | "buyer" | "advisor", firstName: a.first_name as string | null };
  });

export const SETUP_REASONS = ["no_number", "individual", "outside_buyer", "outside_advisor", "check_failed", "too_many"] as const;

/** "Let PitchSnack set up your account": goes with the Contact page's enquiries; failed checks delete the pending sign-up. */
export const sendSetupRequest = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    reason: z.enum(SETUP_REASONS), role: z.enum(["seller", "buyer", "advisor"]),
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().min(6).max(30),
    company: z.string().trim().max(160).nullable(), country: z.string().trim().min(2).max(60), note: z.string().trim().max(2000).nullable(),
    lang: z.enum(["en", "th"]), website: z.string().max(0).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ipHash = ip ? await sha(ip) : null;
    const email = data.email.toLowerCase();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("contact_enquiries").select("id", { count: "exact", head: true }).gte("created_at", since).or(ipHash ? `email.eq.${email},ip_hash.eq.${ipHash}` : `email.eq.${email}`);
    if ((count ?? 0) >= 5) throw new Error("Too many requests. Please try again later.");

    let userId: string | null = null;
    let tried: string[] = [];
    const auth = getRequestHeader("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await sb.auth.getUser(auth.slice(7));
      userId = u?.user?.id ?? null;
    }
    let pendingRow: any = null;
    if (userId) {
      const { data: a } = await sb.from("signup_answers").select("reg_tried, registered_at").eq("user_id", userId).maybeSingle();
      pendingRow = a;
      tried = a?.reg_tried ?? [];
    }
    const REASON_EN: Record<string, string> = { no_number: "No Thai registration number", individual: "Individual Investor without a company", outside_buyer: "Investment firm outside Thailand", outside_advisor: "Advisory firm outside Thailand", check_failed: "Company check failed", too_many: "Too many checks" };
    const message = [`Set-up request: ${REASON_EN[data.reason]}`, `Role: ${data.role}`, `Country: ${data.country}`, `Phone: ${data.phone}`, tried.length ? `Registration numbers tried: ${tried.join(", ")}` : null, data.note ? `Note: ${data.note}` : null].filter(Boolean).join("\n");
    const ym = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" }).formatToParts(new Date());
    const yymm = `${ym.find((p) => p.type === "year")!.value}${ym.find((p) => p.type === "month")!.value}`;
    let reference = "";
    for (let i = 0; i < 6; i++) {
      reference = `ENQ-${yymm}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      const { error } = await sb.from("contact_enquiries").insert({
        reference, role: data.role === "advisor" ? "partner" : data.role, topic: "account", name: data.name, company: data.company || null, email, phone: null,
        message, language: data.lang, consent_at: new Date().toISOString(), user_id: null, ip_hash: ipHash, setup_reason: data.reason, reg_tried: tried,
      });
      if (!error) break;
      if (!String(error.message).includes("duplicate") || i === 5) throw new Error("Could not send the request");
    }
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const rows: [string, string][] = [["Reference", reference], ["Reason", REASON_EN[data.reason]!], ["Role", data.role], ["Name", data.name], ["Company", data.company || "—"], ["Email", email], ["Phone", data.phone], ["Country", data.country], ["Numbers tried", tried.join(", ") || "—"]];
      const r = await sendTemplateEmail("contact-team", "support@pitchsnack.com", { templateData: { reference, role: data.role, topic: "Set-up request", rows, message }, idempotencyKey: `setup-team-${reference}` });
      await sb.from("email_alert_log").insert({ alert_key: "Contact enquiry", role: "team", user_id: null, email: "support@pitchsnack.com", subject: `Set-up request · ${reference}`, ref_key: `contact:${reference}:team`, status: r.sent ? "sent" : "suppressed" });
    } catch (e) { console.error("setup request email", e); }

    // After a failed check or too many checks, the pending sign-up goes: sign-in user, answers and logo.
    if (userId && pendingRow && !pendingRow.registered_at && (data.reason === "check_failed" || data.reason === "too_many")) {
      try {
        await sb.from("signup_answers").delete().eq("user_id", userId);
        const { error } = await sb.auth.admin.deleteUser(userId);
        if (error) console.error("pending sign-up delete", error.message);
      } catch (e) { console.error("pending sign-up delete", e); }
    }
    return { reference };
  });
