import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVENT_TYPES = [
  "LOGIN",
  "LOGOUT",
  "FAILED_LOGIN",
  "PASSWORD_RESET",
  "ROLE_CHANGE",
  "WORKSPACE_SWITCH",
  "USER_INVITED",
  "INVITE_ACCEPTED",
  "INVITE_EXPIRED",
  "ACCOUNT_LOCKED",
  "ACCOUNT_SUSPENDED",
] as const;

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);
    await supabase.from("user_sessions").insert({
      user_id: userId,
      login_time: new Date().toISOString(),
    });
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "LOGIN",
      details: {},
    });
    return { ok: true };
  });

export const recordLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "LOGOUT",
      details: {},
    });
    return { ok: true };
  });

export const logSecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventType: z.enum(EVENT_TYPES),
        tenantId: z.string().uuid().nullable().optional(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("security_events").insert({
      user_id: userId,
      tenant_id: data.tenantId ?? null,
      event_type: data.eventType,
      details: (data.details ?? {}) as never,
    });
    return { ok: true };
  });
