import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function log(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  dealId: string,
  tenantId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabase.from("deal_activity").insert({
    deal_id: dealId, tenant_id: tenantId,
    activity_type: action, activity_details: details, created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, entity_type: "deal", entity_id: dealId,
    action, performed_by: userId, new_value: details,
  });
}

export const addDealDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dealId: z.string().uuid(),
      fileName: z.string().min(1).max(500),
      fileUrl: z.string().url().max(2048),
      documentType: z.string().max(100).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase.from("deals").select("tenant_id").eq("id", data.dealId).maybeSingle();
    if (!deal) throw new Error("Deal not found");
    const { data: ins, error } = await supabase
      .from("deal_documents")
      .insert({
        deal_id: data.dealId,
        tenant_id: deal.tenant_id,
        file_name: data.fileName,
        file_url: data.fileUrl,
        document_type: data.documentType || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await log(supabase, data.dealId, deal.tenant_id, userId, "DOCUMENT_ADDED", {
      id: ins.id, file_name: data.fileName, document_type: data.documentType ?? null,
    });
    return { id: ins.id };
  });

export const removeDealDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("deal_documents")
      .select("id, deal_id, tenant_id, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    const { error } = await supabase.from("deal_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(supabase, doc.deal_id, doc.tenant_id, userId, "DOCUMENT_REMOVED", {
      id: doc.id, file_name: doc.file_name,
    });
    return { ok: true };
  });
