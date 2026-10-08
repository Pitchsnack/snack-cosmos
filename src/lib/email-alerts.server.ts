import { ALERT_BY_KEY, alertText, fill, rolesOf, type AlertLang, type AlertOverrides, type AlertRole } from "@/config/email-alerts";

const SITE = "https://pitchsnack.com";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type SendAlertInput = {
  alert: string;
  role: AlertRole;
  userIds: (string | null | undefined)[];
  vars?: Record<string, string | number | undefined>;
  details?: [string, string][];
  quote?: string | null;
  refKey: string; // event id — dedupes repeat sends
};

/** Render one alert for one recipient; returns subject + template data. */
export function buildAlert(alert: string, role: AlertRole, lang: AlertLang, ov: AlertOverrides | undefined, vars: Record<string, any>, details?: [string, string][], quote?: string | null) {
  const def = ALERT_BY_KEY[alert];
  const t = alertText(def, role, lang, ov);
  const ver = def[role] ?? def[rolesOf(def)[0]!]!;
  return {
    role, lang,
    subject: fill(t.subject, vars), title: fill(t.title, vars), body: fill(t.body, vars),
    button: t.button, place: ver.place, url: SITE + ver.path, color: def.color,
    details, quote: quote ? quote.slice(0, 300) : undefined,
  };
}

/**
 * Sends an email alert to each recipient, respecting Admin's on/off switch for
 * the alert and each user's own Email alerts switch. Every send or skip is
 * logged. Never throws — the in-app notification is the source of truth.
 */
export async function sendAlert(input: SendAlertInput) {
  try {
    const def = ALERT_BY_KEY[input.alert];
    if (!def) return;
    const sb = await admin();
    const ids = [...new Set(input.userIds.filter(Boolean) as string[])];
    if (!ids.length) return;
    const { data: setting } = await sb.from("email_alert_settings").select("enabled, overrides").eq("alert_key", input.alert).maybeSingle();
    const enabled = setting?.enabled ?? true;
    const { data: users } = await sb.from("users").select("id, email").in("id", ids);
    const { data: prefs } = await sb.from("notification_preferences").select("user_id, email_enabled").in("user_id", ids);
    const off = new Set(((prefs ?? []) as any[]).filter((p) => p.email_enabled === false).map((p) => p.user_id));
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    for (const u of (users ?? []) as any[]) {
      const ref = `${input.alert}:${input.role}:${input.refKey}:${u.id}`;
      const data = buildAlert(input.alert, input.role, "en", setting?.overrides, input.vars ?? {}, input.details, input.quote);
      const base = { alert_key: input.alert, role: input.role, user_id: u.id, email: u.email, subject: data.subject, ref_key: ref };
      const { data: dup } = await sb.from("email_alert_log").select("id").eq("ref_key", ref).in("status", ["sent", "suppressed"]).limit(1);
      if (dup?.length) continue;
      if (!enabled) { await sb.from("email_alert_log").insert({ ...base, status: "skipped", reason: "Alert switched off by Admin" }); continue; }
      if (off.has(u.id)) { await sb.from("email_alert_log").insert({ ...base, status: "skipped", reason: "User turned email alerts off" }); continue; }
      if (!u.email) { await sb.from("email_alert_log").insert({ ...base, status: "skipped", reason: "No email address" }); continue; }
      try {
        const r = await sendTemplateEmail("alert", u.email, { templateData: data, idempotencyKey: ref });
        await sb.from("email_alert_log").insert({ ...base, status: r.sent ? "sent" : "suppressed", reason: r.sent ? null : "Address unsubscribed or bouncing" });
      } catch (e) {
        await sb.from("email_alert_log").insert({ ...base, status: "failed", reason: (e as Error).message.slice(0, 300) });
      }
    }
  } catch (e) {
    console.error("[email-alerts]", (e as Error).message);
  }
}

/** Seller team = owning agents of the startup. */
export async function sellerTeam(startupId: string | null | undefined) {
  if (!startupId) return [];
  const sb = await admin();
  const { data } = await sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", startupId);
  return ((data ?? []) as any[]).map((o) => o.owning_agent_user_id).filter(Boolean) as string[];
}

const fmtDate = (d = new Date()) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

/** Maps a deal pipeline event to its email alert. Names stay hidden until the NDA is approved. */
export async function pipelineAlert(pipelineId: string, event: string) {
  const map: Record<string, [string, AlertRole]> = {
    nda_requested: ["nda_request", "seller"],
    nda_approved: ["nda_approved", "buyer"],
    nda_declined: ["nda_declined", "buyer"],
    report_requested: ["financial_report", "seller"],
    report_shared: ["financial_report", "buyer"],
    loi_sent: ["loi", "seller"],
    loi_accepted: ["loi", "buyer"],
    loi_changes_requested: ["loi", "buyer"],
    loi_declined: ["loi", "buyer"],
  };
  const m = map[event];
  if (!m) return;
  try {
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("*").eq("id", pipelineId).maybeSingle();
    if (!p) return;
    const { data: hp } = await sb.from("hidden_profiles").select("code_name, ref_no").eq("id", p.hidden_profile_id).maybeSingle();
    const { data: bp } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", p.buyer_user_id).maybeSingle();
    const { data: iv } = bp?.investor_id ? await sb.from("investors").select("investor_name, investor_type").eq("id", bp.investor_id).maybeSingle() : { data: null };
    const { data: st } = await sb.from("startups").select("startup_name").eq("id", p.startup_id).maybeSingle();
    const ndaOk = !!p.nda_approved_at;
    const buyerCode = iv?.investor_type ? `A ${iv.investor_type} investor` : "A verified investor";
    const vars = {
      "listing code name": hp?.code_name ?? "your listing",
      "buyer code name": buyerCode,
      "buyer company": ndaOk ? iv?.investor_name ?? buyerCode : buyerCode,
      "seller company": ndaOk ? st?.startup_name ?? hp?.code_name : hp?.code_name,
      "report name": "verified financial report",
      date: fmtDate(),
    };
    const [alert, role] = m;
    const details: [string, string][] = [];
    if (alert === "nda_request") details.push(["Buyer", `${buyerCode}`], ["Verified", "Yes"]);
    if (alert === "nda_approved") details.push(["Listing", vars["listing code name"]], ["Approved", fmtDate()], ...(p.nda_expires_at ? [["Valid until", fmtDate(new Date(p.nda_expires_at))] as [string, string]] : []));
    if (alert === "nda_declined") details.push(["Listing", vars["listing code name"]]);
    if (alert === "financial_report" && role === "buyer") details.push(["Report", "Verified financial report"], ["Download", p.report_allow_download ? "Allowed" : "View only"]);
    if (alert === "loi" && role === "buyer") details.push(["Seller", String(vars["seller company"])], ["Reply", event === "loi_accepted" ? "Accepted" : event === "loi_declined" ? "Declined" : "Changes requested"]);
    const userIds = role === "seller" ? await sellerTeam(p.startup_id) : [p.buyer_user_id];
    await sendAlert({ alert, role, userIds, vars, details, refKey: `${pipelineId}:${event}:${Date.now() - (Date.now() % 60000)}` });
  } catch (e) {
    console.error("[email-alerts] pipeline", (e as Error).message);
  }
}
