import type { RegCompany } from "./signup-reg.functions";

/** The register lookup shared by sign-up and + Add. Server-only. */
export function companyFrom(outcome: any): RegCompany {
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

/** One register lookup; the held check keeps `raw` server-side only. */
export async function lookupCheck(reg: string): Promise<any> {
  const { lookupDbdFinancials } = await import("./financials/dbd-provider.server");
  let outcome: any;
  try { outcome = await lookupDbdFinancials({ registeredNumber: reg, companyOnly: true }); }
  catch (e: any) { outcome = { status: "unavailable", detail: String(e?.message ?? e) }; }
  const found = outcome.status === "ok" || outcome.status === "no_financials";
  if (found) {
    const company = companyFrom(outcome);
    if (company.addressTh && !company.addressEn) {
      const en = await translateAddress(company.addressTh);
      if (en) { company.addressEn = en; company.translated = true; }
    }
    return { status: "found", reg, company, raw: { ...outcome, lookupScope: "company" } };
  }
  return outcome.status === "not_found" ? { status: "not_found", reg } : { status: "unavailable" };
}


/** Saves one registration number tried (sign-up or + Add). Never throws. */
export async function logAttempt(sb: any, row: { reg: string; userId?: string | null; email?: string | null; source: "signup" | "add"; kind?: string | null; profileId?: string | null; session?: string | null; result: string; company?: RegCompany | null; held?: unknown }) {
  try {
    const { data } = await sb.from("registration_attempts").insert({
      reg_no: row.reg, user_id: row.userId ?? null, email: row.email ?? null, source: row.source, profile_kind: row.kind ?? null, profile_id: row.profileId ?? null,
      session_key: row.session ?? null, result: row.result, company_name: row.company ? row.company.nameTh ?? row.company.nameEn : null, held: row.held ?? null,
    }).select("id").single();
    return (data?.id as string | undefined) ?? null;
  } catch (e) { console.error("registration attempt", e); return null; }
}
/** Answers the newest pending sign-up attempt of a user. */
export async function answerSignupAttempt(sb: any, userId: string, result: "yes" | "no" | "cancelled") {
  try {
    const { data } = await sb.from("registration_attempts").select("id").eq("user_id", userId).eq("source", "signup").eq("result", "pending").order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) await sb.from("registration_attempts").update({ result }).eq("id", data[0].id);
  } catch (e) { console.error("registration attempt", e); }
}

export async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
/** 5 checks a day per device (browser id or IP), sign-up and + Add counted together in signup_reg_checks. */
export async function deviceLimit(sb: any, deviceId: string) {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const deviceHash = await sha(`d:${deviceId}`);
  const ipHash = ip ? await sha(`i:${ip}`) : null;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await sb.from("signup_reg_checks").select("id", { count: "exact", head: true }).gte("created_at", since).neq("result", "unavailable")
    .or(ipHash ? `device_hash.eq.${deviceHash},ip_hash.eq.${ipHash}` : `device_hash.eq.${deviceHash}`);
  return { over: (count ?? 0) >= 5, deviceHash, ipHash };
}

export type HeldLogoIn = { data: string; type: "image/webp" | "image/svg+xml" | "image/png" | "image/jpeg" } | null | undefined;
/** Uploads a held (browser-converted) logo to where the setup wizards save it. Returns the path or null. */
export async function uploadHeldLogo(sb: any, logo: HeldLogoIn, pathFor: (ext: string) => string): Promise<string | null> {
  if (!logo) return null;
  const m = /^data:([^;]+);base64,(.+)$/.exec(logo.data);
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[2]!), (ch) => ch.charCodeAt(0));
  if (bytes.byteLength > 2 * 1024 * 1024) return null;
  const ext = logo.type === "image/svg+xml" ? "svg" : logo.type === "image/png" ? "png" : logo.type === "image/jpeg" ? "jpg" : "webp";
  const path = pathFor(ext);
  const { error } = await sb.storage.from("startup-media").upload(path, bytes, { contentType: logo.type, upsert: true });
  return error ? null : path;
}

/**
 * At "Yes": the one DBD store write shared by sign-up and + Add. Company-only identity checks are not
 * saved as a completed financial extraction; Admin/report flows fetch those later.
 */
export async function saveDbdAfterYes(sb: any, userId: string, reg: string, raw: any) {
  if (!raw || raw.lookupScope === "company") return false;
  try {
    const { outcomeToData } = await import("./dbd-store.server");
    await sb.rpc("dbd_store_save_signup", { _user: userId, _reg: reg, _data: outcomeToData(raw), _raw: raw });
    return true;
  } catch (e) { console.error("dbd store", e); return false; }
}
