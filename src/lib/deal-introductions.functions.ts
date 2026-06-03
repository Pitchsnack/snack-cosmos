import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// PRD 7 — Deal Introduction Workflow
// Introductions are tracked separately from sharing. They reference the
// origin deal (and its startup/investor) without copying any data.

export const INTRODUCTION_STATUSES = [
  "Requested","Pending","Introduced","Meeting","Completed","Declined",
] as const;
export type IntroductionStatus = (typeof INTRODUCTION_STATUSES)[number];

async function logIntroAudit(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  introId: string,
  tenantId: string,
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "deal_introduction",
    entity_id: introId,
    action,
    performed_by: userId,
    new_value: details,
  });
}

export const listIntroductions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("deal_introductions")
      .select(`
        id, status, created_at, updated_at,
        deal_id, startup_id, investor_id,
        introduced_by_user_id, introduced_to_user_id,
        intro_by:introduced_by_user_id(email, first_name, last_name),
        intro_to:introduced_to_user_id(email, first_name, last_name)
      `)
      .eq("deal_id", data.dealId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const requestIntroduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dealId: z.string().uuid(),
      introducedToUserId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("id, tenant_id, startup_id, investor_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!deal) throw new Error("Deal not found");

    const { data: ins, error } = await supabase
      .from("deal_introductions")
      .insert({
        tenant_id: deal.tenant_id,
        deal_id: deal.id,
        startup_id: deal.startup_id,
        investor_id: deal.investor_id,
        introduced_by_user_id: userId,
        introduced_to_user_id: data.introducedToUserId ?? null,
        status: "Requested",
      })
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    await logIntroAudit(supabase, ins.id, ins.tenant_id, userId, "INTRODUCTION_REQUESTED", {
      deal_id: deal.id, target: data.introducedToUserId ?? null,
    });
    return { id: ins.id };
  });

export const updateIntroductionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(INTRODUCTION_STATUSES),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("deal_introductions").select("tenant_id, status").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Introduction not found");

    const { error } = await supabase
      .from("deal_introductions").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);

    const map: Record<IntroductionStatus, string> = {
      Requested: "INTRODUCTION_REQUESTED",
      Pending: "INTRODUCTION_REQUESTED",
      Introduced: "INTRODUCTION_APPROVED",
      Meeting: "INTRODUCTION_APPROVED",
      Completed: "INTRODUCTION_COMPLETED",
      Declined: "INTRODUCTION_DECLINED",
    };
    await logIntroAudit(supabase, data.id, row.tenant_id, userId, map[data.status],
      { from: row.status, to: data.status });
    return { ok: true };
  });
