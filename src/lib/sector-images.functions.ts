import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECTORS } from "@/lib/sectors";

/**
 * Sector images: Admin-uploaded pictures buyers see as listing covers.
 * Files live in the private "public-images" bucket; readers get signed URLs.
 * Only admins who can approve listings (is_control) add or delete.
 */

const BUCKET = "public-images";

export type SectorImage = {
  id: string;
  sector_key: string;
  file_name: string;
  width: number;
  height: number;
  size_bytes: number;
  uploaded_at: string;
  url: string | null;
};

type Ctx = { supabase: any; userId: string };

async function isApprover(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  return !!data;
}
async function assertApprover(ctx: Ctx) {
  if (!(await isApprover(ctx))) throw new Error("Admin only");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const canManageSectorImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => isApprover(context as Ctx));

export const listSectorImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SectorImage[]> => {
    const { data, error } = await (context.supabase as any)
      .from("sector_images")
      .select("id, sector_key, storage_path, file_name, width, height, size_bytes, uploaded_at")
      .order("uploaded_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as (Omit<SectorImage, "url"> & { storage_path: string })[];
    if (!rows.length) return [];
    const sb = await admin();
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 60 * 60 * 12);
    const byPath = new Map<string, string>((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
    return rows.map(({ storage_path, ...r }) => ({ ...r, url: byPath.get(storage_path) ?? null }));
  });

export const addSectorImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      sector: z.string().refine((s) => SECTORS.includes(s), "Unknown sector"),
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
    const ext = data.mime === "image/png" ? "png" : "jpg";
    const path = `${slug(data.sector)}/${id}.${ext}`;
    const sb = await admin();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: data.mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { error } = await sb.from("sector_images").insert({
      id, sector_key: data.sector, storage_path: path, file_name: data.fileName,
      width: data.width, height: data.height, size_bytes: bytes.byteLength, uploaded_by: context.userId,
    });
    if (error) {
      await sb.storage.from(BUCKET).remove([path]);
      throw new Error(error.message);
    }
    await sb.from("audit_logs").insert({
      entity_type: "sector_image", entity_id: id, action: "Sector image added", performed_by: context.userId,
      new_value: { sector: data.sector, file_name: data.fileName },
    });
    return { id };
  });

export const deleteSectorImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertApprover(context as Ctx);
    const sb = await admin();
    const { data: row } = await sb.from("sector_images").select("id, sector_key, storage_path, file_name").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Image not found");
    const { error } = await sb.from("sector_images").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    await sb.storage.from(BUCKET).remove([row.storage_path]);
    await sb.from("audit_logs").insert({
      entity_type: "sector_image", entity_id: row.id, action: "Sector image deleted", performed_by: context.userId,
      old_value: { sector: row.sector_key, file_name: row.file_name },
    });
    return { ok: true };
  });

/** Set public image (Approvals): picks one of the listing's own sector images, or clears it. */
export const setListingPublicImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), imageId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertApprover(context as Ctx);
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("id, startups(sector)").eq("id", data.id).maybeSingle();
    if (!hp) throw new Error("Listing not found");
    if (data.imageId) {
      const { data: img } = await sb.from("sector_images").select("sector_key").eq("id", data.imageId).maybeSingle();
      if (!img || img.sector_key !== (hp as any).startups?.sector) throw new Error("Pick an image from this listing's sector");
    }
    const { error } = await sb.from("hidden_profiles").update({ public_image_id: data.imageId }).eq("id", hp.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Edit information › Listing Identity: the seller picks one of their sector's
 * images for the listing cover (the same public_image_id Admin's Set public
 * image sets). Members of the business and approvers only; the image must
 * belong to the business's current sector. null clears the pick.
 */
export const setMyListingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), imageId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: member } = await ctx.supabase.rpc("is_startup_member", { _startup_id: data.startupId, _user_id: ctx.userId });
    if (!member && !(await isApprover(ctx))) throw new Error("You can't change this listing");
    const sb = await admin();
    const { data: st } = await sb.from("startups").select("sector").eq("id", data.startupId).maybeSingle();
    if (data.imageId) {
      const { data: img } = await sb.from("sector_images").select("sector_key").eq("id", data.imageId).maybeSingle();
      if (!img || img.sector_key !== st?.sector) throw new Error("Pick an image from your business's sector");
    }
    const { error } = await sb.from("hidden_profiles").update({ public_image_id: data.imageId }).eq("startup_id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
