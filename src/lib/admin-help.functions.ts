import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HelpProfile = {
  id: string; name: string; first: string; role: "seller" | "buyer" | "advisor";
  company: string; email: string; phone: string | null; joined: string;
  statuses: { label: string; value: string }[]; advisor: string | null;
};
export type HelpSummary = {
  key: string; profile: HelpProfile; unread: number;
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