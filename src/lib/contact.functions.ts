import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public Contact form: validates, rate-limits, saves the enquiry and sends both emails. */
const TOPICS = ["selling", "buying", "partner", "plans", "verification", "account", "press", "other"] as const;
const TOPIC_EN: Record<string, string> = { selling: "Selling my business", buying: "Buying or investing in a business", partner: "Joining as a partner", plans: "Plans and billing", verification: "Verification and badges", account: "My account and signing in", press: "Press and collaborations", other: "Something else" };
const TOPIC_TH: Record<string, string> = { selling: "การขายกิจการ", buying: "การซื้อหรือลงทุนในกิจการ", partner: "การเข้าร่วมเป็นพาร์ทเนอร์", plans: "แผนบริการและการชำระเงิน", verification: "การตรวจสอบและตราสัญลักษณ์", account: "บัญชีผู้ใช้และการเข้าสู่ระบบ", press: "สื่อมวลชนและความร่วมมือ", other: "เรื่องอื่นๆ" };

const input = z.object({
  role: z.enum(["seller", "buyer", "partner", "other"]),
  topic: z.enum(TOPICS),
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().max(254),
  phone: z.string().regex(/^\d{8,10}$/).optional().nullable(),
  message: z.string().trim().min(20).max(2000),
  language: z.enum(["th", "en"]),
  consent: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
});

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const sendContactEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const sb = supabaseAdmin as any;
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ipHash = ip ? await sha(ip) : null;
    const email = data.email.toLowerCase();
    const since = new Date(Date.now() - 3600_000).toISOString();
    const orFilter = ipHash ? `email.eq.${email},ip_hash.eq.${ipHash}` : `email.eq.${email}`;
    const { count } = await sb.from("contact_enquiries").select("id", { count: "exact", head: true }).gte("created_at", since).or(orFilter);
    if ((count ?? 0) >= 5) throw new Error("Too many enquiries. Please try again later.");

    let userId: string | null = null;
    const auth = getRequestHeader("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await sb.auth.getUser(auth.slice(7));
      userId = u?.user?.id ?? null;
    }
    const phone = data.phone ? `+66${data.phone.replace(/^0/, "")}` : null;
    const ym = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "2-digit", month: "2-digit" }).formatToParts(new Date());
    const yymm = `${ym.find((p) => p.type === "year")!.value}${ym.find((p) => p.type === "month")!.value}`;
    let reference = "";
    for (let i = 0; i < 6; i++) {
      reference = `ENQ-${yymm}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      const { error } = await sb.from("contact_enquiries").insert({
        reference, role: data.role, topic: data.topic, name: data.name, company: data.company || null, email, phone,
        message: data.message, language: data.language, consent_at: new Date().toISOString(), user_id: userId, ip_hash: ipHash,
      });
      if (!error) break;
      if (!String(error.message).includes("duplicate")) throw new Error("Could not save the enquiry");
      if (i === 5) throw new Error("Could not save the enquiry");
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const log = async (to: string, subject: string, role: string, run: () => Promise<{ sent: boolean }>) => {
      const base = { alert_key: "Contact enquiry", role, user_id: userId, email: to, subject, ref_key: `contact:${reference}:${role}` };
      try { const r = await run(); await sb.from("email_alert_log").insert({ ...base, status: r.sent ? "sent" : "suppressed" }); }
      catch (e) { await sb.from("email_alert_log").insert({ ...base, status: "failed", reason: (e as Error).message.slice(0, 300) }); }
    };
    const th = data.language === "th";
    const topicText = (th ? TOPIC_TH : TOPIC_EN)[data.topic]!;
    const first = data.name.split(/\s+/)[0]!;
    await log(email, th ? `เราได้รับคำถามของท่านแล้ว · ${reference}` : `We have your enquiry · ${reference}`, "sender", () =>
      sendTemplateEmail("contact-confirm", email, { templateData: { lang: data.language, name: first, reference, topic: topicText, message: data.message }, idempotencyKey: `contact-confirm-${reference}` }));
    const rows: [string, string][] = [["Reference", reference], ["I am", data.role], ["Topic", TOPIC_EN[data.topic]!], ["Name", data.name], ["Company", data.company || "—"], ["Email", email], ["Phone", phone ?? "—"], ["Language", data.language], ["Signed in", userId ? "Yes" : "No"]];
    await log("support@pitchsnack.com", `New enquiry · ${data.role} · ${TOPIC_EN[data.topic]} · ${reference}`, "team", () =>
      sendTemplateEmail("contact-team", "support@pitchsnack.com", { templateData: { reference, role: data.role, topic: TOPIC_EN[data.topic], rows, message: data.message }, idempotencyKey: `contact-team-${reference}` }));
    return { reference, first, email };
  });
