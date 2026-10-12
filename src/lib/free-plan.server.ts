// Server-only: access-code free plans — reminder, end, and their two emails.
import { bkkToday, dateEn, dateTh, daysLeft } from "./access-codes";
import type { MailPart } from "./email-templates/soft-launch";

const SUBS_URL = "https://pitchsnack.com/preferences#subscription";
type Role = "seller" | "buyer" | "advisor";

const WILL: Record<Role, { th: string; en: string }> = {
  seller: { th: "บัญชีของท่านจะกลับไปใช้แผน Entry ฟรี ผู้ซื้อยังค้นหาธุรกิจของท่านได้ แต่ท่านจะส่งคำขอติดต่อเองไม่ได้", en: "your account goes back to Entry, free: buyers can still find your business, but you can’t send contact requests." },
  buyer: { th: "บัญชีของท่านจะไม่มีแผน เช่นเดียวกับผู้ซื้อที่สมัครใหม่ และการขอ NDA จะต้องมีแผนอีกครั้ง", en: "your account will have no plan, as a new buyer’s does, and NDA requests will need a plan again." },
  advisor: { th: "บัญชีของท่านจะไม่มีแผน เช่นเดียวกับที่ปรึกษาที่สมัครใหม่ และการส่งคำขอติดต่อจะต้องมีแผนอีกครั้ง", en: "your account will have no plan, as a new advisor’s does, and contact requests will need a plan again." },
};
const NOW: Record<Role, { th: string; en: string }> = {
  seller: { th: "ตอนนี้บัญชีของท่านใช้แผน Entry ฟรี ผู้ซื้อยังค้นหาธุรกิจของท่านได้ แต่ท่านจะส่งคำขอติดต่อเองไม่ได้", en: "Your account is now on Entry, free: buyers can still find your business, but you can’t send contact requests." },
  buyer: { th: "ตอนนี้บัญชีของท่านไม่มีแผน เช่นเดียวกับผู้ซื้อที่สมัครใหม่ การขอ NDA ต้องมีแผน", en: "Your account has no plan now, as a new buyer’s does, so NDA requests need a plan." },
  advisor: { th: "ตอนนี้บัญชีของท่านไม่มีแผน เช่นเดียวกับที่ปรึกษาที่สมัครใหม่ การส่งคำขอติดต่อต้องมีแผน", en: "Your account has no plan now, as a new advisor’s does, so contact requests need a plan." },
};
const btnTh = { label: "เลือกแผน", url: SUBS_URL };
const btnEn = { label: "Choose a plan", url: SUBS_URL };
const enDays = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** Bangkok date (YYYY-MM-DD) of a term_end timestamp. */
export const lastDayOf = (termEnd: string) => bkkToday(new Date(termEnd));

async function send(sb: any, alertKey: string, user: any, ref: string, subject: string, th: MailPart, en: MailPart) {
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const base = { alert_key: alertKey, role: user.account_role, user_id: user.id, email: user.email, subject, ref_key: ref };
  try {
    const r = await sendTemplateEmail("soft-launch", user.email, { templateData: { subject, th, en }, idempotencyKey: ref });
    await sb.from("email_alert_log").insert({ ...base, status: r.sent ? "sent" : "suppressed" });
  } catch (e) {
    await sb.from("email_alert_log").insert({ ...base, status: "failed", reason: (e as Error).message.slice(0, 300) });
  }
}

async function userOf(sb: any, id: string) {
  const { data } = await sb.from("users").select("id,email,first_name,account_role").eq("id", id).maybeSingle();
  return data;
}

export async function sendReminder(sb: any, sub: any) {
  const u = await userOf(sb, sub.user_id);
  const role = u?.account_role as Role;
  if (!u?.email || !WILL[role]) return;
  const plan = sub.plans?.name ?? "PitchSnack";
  const last = lastDayOf(sub.term_end);
  const n = Math.max(0, daysLeft({ ends_on: last }) ?? 0);
  const subject = `แผน ${plan} ที่ท่านใช้ฟรีจะสิ้นสุดใน ${n} วัน · Your free ${plan} plan ends in ${enDays(n)}`;
  await send(sb, "Free plan ending", u, `free-remind-${sub.user_id}-${last}`, subject,
    { title: `แผน ${plan} ที่ท่านใช้ฟรีจะสิ้นสุดใน ${n} วัน`, lines: [`เรียน คุณ${u.first_name ?? ""}`, `แผน ${plan} ที่ท่านใช้ฟรีตามคำเชิญทดลองใช้งาน PitchSnack จะสิ้นสุดในวันที่ ${dateTh(last)}`, `หากต้องการใช้ต่อ กรุณาเลือกแผนก่อนวันดังกล่าว หากไม่ได้เลือก ${WILL[role].th} ข้อมูลทั้งหมดของท่านยังอยู่ครบ`], button: btnTh },
    { title: `Your free ${plan} plan ends in ${enDays(n)}`, lines: [`Dear ${u.first_name ?? ""},`, `The ${plan} plan you’ve been using free with your PitchSnack soft-launch invitation ends on ${dateEn(last)}.`, `To keep it, choose a plan before then. If you don’t, ${WILL[role].en} Everything you’ve added stays.`], button: btnEn });
  await sb.from("subscriptions").update({ free_reminder_sent_at: new Date().toISOString() }).eq("user_id", sub.user_id);
}

/** Ends a free plan that ran its full term: sellers go on Entry, buyers and advisors have no plan. Sends the end email once. */
export async function endFreePlan(sb: any, sub: any) {
  const u = await userOf(sb, sub.user_id);
  const role = u?.account_role as Role;
  const plan = sub.plans?.name ?? null;
  const last = lastDayOf(sub.term_end);
  const record = { free_plan_name: plan, free_ended_on: last };
  if (role === "seller") {
    const { data: entry } = await sb.from("plans").select("id, term_months").eq("role", "seller").eq("status", "live").order("sort").limit(1).maybeSingle();
    if (entry) {
      const end = new Date(); end.setMonth(end.getMonth() + entry.term_months);
      await sb.from("subscriptions").update({ ...record, plan_id: entry.id, status: "active", source: null, term_start: new Date().toISOString(), term_end: end.toISOString(), price_paid_thb: 0, price_locked_thb: null }).eq("user_id", sub.user_id);
    } else await sb.from("subscriptions").update({ ...record, status: "ended" }).eq("user_id", sub.user_id);
  } else {
    await sb.from("subscriptions").update({ ...record, status: "ended" }).eq("user_id", sub.user_id).eq("source", "access_code");
  }
  if (!sub.free_end_email_sent_at && u?.email && NOW[role] && plan) {
    const subject = `แผน ${plan} ที่ท่านใช้ฟรีสิ้นสุดแล้ว · Your free ${plan} plan has ended`;
    await send(sb, "Free plan ended", u, `free-end-${sub.user_id}-${last}`, subject,
      { title: `แผน ${plan} ที่ท่านใช้ฟรีสิ้นสุดแล้ว`, lines: [`เรียน คุณ${u.first_name ?? ""}`, `แผน ${plan} ที่ท่านใช้ฟรีตามคำเชิญทดลองใช้งานสิ้นสุดเมื่อวันที่ ${dateTh(last)} ${NOW[role].th} ข้อมูลทั้งหมดของท่านยังอยู่ครบ`, "เลือกแผนได้ทุกเมื่อเพื่อใช้งานต่อ"], button: btnTh },
      { title: `Your free ${plan} plan has ended`, lines: [`Dear ${u.first_name ?? ""},`, `The ${plan} plan you used free with your soft-launch invitation ended on ${dateEn(last)}. ${NOW[role].en} Everything you’ve added stays.`, "Choose a plan whenever you’re ready to carry on."], button: btnEn });
    await sb.from("subscriptions").update({ free_end_email_sent_at: new Date().toISOString() }).eq("user_id", sub.user_id);
  }
}

/** A free plan still running whose last free day has passed. */
export const freeOverdue = (sub: any) => sub?.source === "access_code" && sub.status === "active" && !!sub.term_end && lastDayOf(sub.term_end) < bkkToday();

/** Daily job: reminders 14 days ahead, then ends overdue free plans. Safe to run more than once. */
export async function runFreePlanJob(sb: any) {
  const { data: subs } = await sb.from("subscriptions").select("*, plans(name)").eq("source", "access_code").eq("status", "active");
  let reminded = 0, ended = 0;
  for (const s of subs ?? []) {
    try {
      if (freeOverdue(s)) { await endFreePlan(sb, s); ended++; continue; }
      const n = daysLeft({ ends_on: lastDayOf(s.term_end) });
      if (n != null && n <= 14 && !s.free_reminder_sent_at) { await sendReminder(sb, s); reminded++; }
    } catch (e) { console.error("free plan job", s.user_id, e); }
  }
  return { reminded, ended };
}
