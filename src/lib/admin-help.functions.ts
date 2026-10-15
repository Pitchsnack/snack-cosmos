import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HelpProfile = {
  id: string; name: string; first: string; role: "seller" | "buyer" | "advisor";
  company: string; email: string; phone: string | null; joined: string;
  statuses: { label: string; value: string }[]; advisor: string | null;
};
export type HelpSummary = {
  key: string; profile: HelpProfile; unread: number; done: { by: string; at: string } | null;
  last: { body: string; mine: boolean; at: string; from: string | null } | null;
};

export const adminHelpSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HelpSummary[]> => {
    const H = await import("./admin-help.server");
    await H.requireHelpAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return H.helpSummaries(supabaseAdmin, context.userId);
  });

export const adminHelpCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const H = await import("./admin-help.server");
    await H.requireHelpAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await H.helpSummaries(supabaseAdmin, context.userId)).reduce((n, s) => n + s.unread, 0);
  });
/** Mark as done / Reopen — Control Admins only; the user's side never changes. */
export const setHelpDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().regex(/^a:[0-9a-f-]{36}$/), done: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const H = await import("./admin-help.server");
    await H.requireHelpAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const { error } = data.done
      ? await sb.from("help_thread_status").upsert({ thread_key: data.key, done_by: context.userId, done_at: new Date().toISOString() })
      : await sb.from("help_thread_status").delete().eq("thread_key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
