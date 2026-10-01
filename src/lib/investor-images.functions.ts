import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Investor images: Admin-uploaded pictures sellers see as investor profile covers.
 * Same storage/approver rules as sector images (private "public-images" bucket, is_control writes).
 */

const BUCKET = "public-images";

export const INVESTOR_IMAGE_TYPES = [
  "Investor",
  "Family office",
  "Private equity",
  "Venture capital",
  "Corporate VC",
  "Corporate buyer",
  "Incubator / Accelerator",
  "Authorised representative / adviser",
  "Individual investor",
] as const;

export type InvestorImage = {
  id: string;
  type_key: string;
  file_name: string;
  width: number;
  height: number;
  size_bytes: number;
  uploaded_at: string;
  url: string | null;
};

type Ctx = { supabase: any; userId: string };
async function assertApprover(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Admin only");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const listInvestorImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvestorImage[]> => {
    const { data, error } = await (context.supabase as any)
      .from("investor_images")
      .select("id, type_key, storage_path, file_name, width, height, size_bytes, uploaded_at")
      .order("uploaded_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as (Omit<InvestorImage, "url"> & { storage_path: string })[];
    if (!rows.length) return [];
    const sb = await admin();
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 60 * 60 * 12);
    const byPath = new Map<string, string>((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
    return rows.map(({ storage_path, ...r }) => ({ ...r, url: byPath.get(storage_path) ?? null }));
  });

export const addInvestorImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      type: z.enum(INVESTOR_IMAGE_TYPES),
      fileName: z.string().min(1).max(200),
      width: z.number().int().min(1).max(1920),
      height: z.number().int().min(1).max(1080),
      mime: z.enum(["image/jpeg", "image/png"]),
      base64: z.string().min(10).max(7_500_000),
    }).refine((d) => d.width > d.height, "Landscape only").parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertApprover(context as Ctx);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Up to 5 MB");
    const id = crypto.randomUUID();
    const path = `investor-types/${slug(data.type)}/${id}.${data.mime === "image/png" ? "png" : "jpg"}`;
    const sb = await admin();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: data.mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { error } = await sb.from("investor_images").insert({
      id, type_key: data.type, storage_path: path, file_name: data.fileName,
      width: data.width, height: data.height, size_bytes: bytes.byteLength, uploaded_by: context.userId,
    });
    if (error) {
      await sb.storage.from(BUCKET).remove([path]);
      throw new Error(error.message);
    }
    await sb.from("audit_logs").insert({
      entity_type: "investor_image", entity_id: id, action: "Investor image added", performed_by: context.userId,
      new_value: { type: data.type, file_name: data.fileName },
    });
    return { id };
  });

export const deleteInvestorImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertApprover(context as Ctx);
    const sb = await admin();
    const { data: row } = await sb.from("investor_images").select("id, type_key, storage_path, file_name").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Image not found");
    const { error } = await sb.from("investor_images").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    await sb.storage.from(BUCKET).remove([row.storage_path]);
    await sb.from("audit_logs").insert({
      entity_type: "investor_image", entity_id: row.id, action: "Investor image deleted", performed_by: context.userId,
      old_value: { type: row.type_key, file_name: row.file_name },
    });
    return { ok: true };
  });
