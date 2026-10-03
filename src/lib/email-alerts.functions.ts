import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Admin only");
}

export type AlertRules = {
  quietEnabled: boolean; quietStart: string; quietEnd: string;
  messageMode: "instant" | "daily"; dailyTime: string;
  matchThreshold: number; weeklyDay: number; weeklyTime: string;
};

export const getEmailAlertsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = context.supabase;
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data: settings }, { data: rules }, { data: week }, { data: log }, { data: prefs }, { count: total }] = await Promise.all([
      sb.from("email_alert_settings").select("alert_key, enabled, overrides"),
      sb.from("email_alert_rules").select("*").eq("id", 1).maybeSingle(),
      sb.from("email_alert_log").select("alert_key, status, user_id").gte("created_at", since).limit(5000),
      sb.from("email_alert_log").select("id, alert_key, role, email, subject, status, reason, created_at").order("created_at", { ascending: false }).limit(200),
      sb.from("notification_preferences").select("user_id").eq("email_enabled", false),
      sb.from("users").select("id", { count: "exact", head: true }),
    ]);
    const w = (week ?? []) as any[];
    const sent = w.filter((r) => r.status === "sent");
    const perAlert: Record<string, number> = {};
    for (const r of sent) perAlert[r.alert_key] = (perAlert[r.alert_key] ?? 0) + 1;
    const r = rules ?? {};
    return {
      settings: Object.fromEntries(((settings ?? []) as any[]).map((s) => [s.alert_key, { enabled: s.enabled as boolean, overrides: s.overrides ?? {} }])) as Record<string, { enabled: boolean; overrides: any }>,
      rules: {
        quietEnabled: r.quiet_enabled ?? true, quietStart: r.quiet_start ?? "22:00", quietEnd: r.quiet_end ?? "07:00",
        messageMode: r.message_mode ?? "instant", dailyTime: r.daily_time ?? "09:00",
        matchThreshold: r.match_threshold ?? 4, weeklyDay: r.weekly_day ?? 1, weeklyTime: r.weekly_time ?? "09:00",
      } as AlertRules,
      stats: {
        sent: sent.length, users: new Set(sent.map((x) => x.user_id)).size,
        suppressed: w.filter((x) => x.status === "suppressed").length,
        failed: w.filter((x) => x.status === "failed").length,
        emailOff: (prefs ?? []).length, totalUsers: total ?? 0, perAlert,
      },
      log: (log ?? []) as { id: string; alert_key: string; role: string; email: string | null; subject: string | null; status: string; reason: string | null; created_at: string }[],
    };
  });

const Text = z.object({ subject: z.string().max(300), title: z.string().max(300), body: z.string().max(2000), button: z.string().max(80) }).partial();

export const saveEmailAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    key: z.string().min(1).max(50),
    enabled: z.boolean().optional(),
    overrides: z.record(z.enum(["seller", "buyer"]), z.record(z.enum(["en", "th"]), Text)).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = context.supabase;
    const { data: cur } = await sb.from("email_alert_settings").select("enabled, overrides").eq("alert_key", data.key).maybeSingle();
    const { error } = await sb.from("email_alert_settings").upsert({
      alert_key: data.key,
      enabled: data.enabled ?? cur?.enabled ?? true,
      overrides: data.overrides ?? cur?.overrides ?? {},
      updated_at: new Date().toISOString(), updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveEmailAlertRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    quietEnabled: z.boolean(), quietStart: z.string().regex(/^\d{2}:\d{2}$/), quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
    messageMode: z.enum(["instant", "daily"]), dailyTime: z.string().regex(/^\d{2}:\d{2}$/),
    matchThreshold: z.number().int().min(1).max(5), weeklyDay: z.number().int().min(0).max(6), weeklyTime: z.string().regex(/^\d{2}:\d{2}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("email_alert_rules").update({
      quiet_enabled: data.quietEnabled, quiet_start: data.quietStart, quiet_end: data.quietEnd,
      message_mode: data.messageMode, daily_time: data.dailyTime, match_threshold: data.matchThreshold,
      weekly_day: data.weeklyDay, weekly_time: data.weeklyTime, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends sample alerts to the signed-in Admin (one alert, or all 10 × seller/buyer × EN/TH). */
export const sendTestAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().max(50).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { EMAIL_ALERTS } = await import("@/config/email-alerts");
    const { buildAlert } = await import("./email-alerts.server");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: me } = await sb.from("users").select("email").eq("id", context.userId).maybeSingle();
    if (!me?.email) throw new Error("Your account has no email address");
    const { data: settings } = await sb.from("email_alert_settings").select("alert_key, overrides");
    const ov = Object.fromEntries(((settings ?? []) as any[]).map((s) => [s.alert_key, s.overrides]));
    const sample = { "listing code name": "Project Nimbus", "buyer code name": "Investor Heron", "buyer company": "Heron Capital", "seller company": "Nimbus Co., Ltd.", "report name": "verified financial report", sender: "Investor Heron", n: 4, date: "3 Oct 2026", note: "Please add your registration number." };
    const list = EMAIL_ALERTS.filter((a) => !data.key || a.key === data.key);
    let sent = 0;
    for (const a of list) for (const role of ["seller", "buyer"] as const) for (const lang of ["en", "th"] as const) {
      const d = buildAlert(a.key, role, lang, ov[a.key], sample, [["Example", "Sample data"]], a.key === "new_message" || a.key === "changes_requested" ? "This is a sample quote." : null);
      d.subject = `[Test] ${d.subject}`;
      try {
        const r = await sendTemplateEmail("alert", me.email, { templateData: d, idempotencyKey: `test:${a.key}:${role}:${lang}:${Date.now()}` });
        await sb.from("email_alert_log").insert({ alert_key: a.key, role, user_id: context.userId, email: me.email, subject: d.subject, status: r.sent ? "test" : "suppressed", reason: `Test · ${lang.toUpperCase()}` });
        if (r.sent) sent++;
      } catch (e) {
        await sb.from("email_alert_log").insert({ alert_key: a.key, role, user_id: context.userId, email: me.email, subject: d.subject, status: "failed", reason: (e as Error).message.slice(0, 300) });
      }
    }
    return { sent, email: me.email };
  });
