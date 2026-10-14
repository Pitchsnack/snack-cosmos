import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * My Company: which of the caller's own companies are "Managed by PitchSnack".
 * Only Admin owners can own a managed company, so anyone else gets nothing.
 * Only the ids of managed companies the caller can already see leave the server.
 */
export const myManagedIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["startup", "investor", "firm"]), ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return [] as string[];
    const { data: me } = await context.supabase.from("users").select("account_role").eq("id", context.userId).maybeSingle();
    if ((me as { account_role?: string } | null)?.account_role !== "admin") return [] as string[];
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const m = await import("./managed.server");
    if (data.kind === "startup") return [...(await m.managedStartupIds(sb, data.ids))];
    if (data.kind === "investor") return [...(await m.managedInvestorIds(sb, data.ids))];
    const { data: firms } = await sb.from("advisor_firms").select("id, owner_user_id").in("id", data.ids);
    return [...(await m.managedFirmIds(sb, (firms ?? []) as { id: string; owner_user_id: string | null }[]))];
  });
