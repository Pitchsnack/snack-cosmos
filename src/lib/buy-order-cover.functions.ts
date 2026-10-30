import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validCoverFile } from "./buy-order-cover";
const picture = z.object({ fileName: z.string().min(1).max(200), base64: z.string().min(10).max(7_000_000), originalBase64: z.string().min(10).max(7_000_000) });
export const saveBuyOrderCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), imageId: z.string().uuid().nullable(), upload: picture.nullable(), keepUpload: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("./profile-handover.server")).requireControlAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: row, error } = await sb.from("buy_orders").select("*").eq("id", data.id).single();
    if (error || !row || row.status !== "waiting") throw new Error("This buy order has changed. Refresh and try again.");
    if (data.keepUpload && !data.upload && !data.imageId) return { cover: await (await (await import("./buy-order-cover.server")).buyOrderCoverResolver(sb))(row) };
    if (data.upload && data.imageId) throw new Error("Pick one picture.");
    if (data.imageId) {
      const { data: img } = await sb.from("sector_images").select("sector_key").eq("id", data.imageId).maybeSingle();
      if (!img || img.sector_key !== row.sector) throw new Error("Pick an image from this buy order's sector.");
    }
    let path: string | null = null;
    if (data.upload) {
      const { imageSize } = await import("image-size");
      const original = Buffer.from(data.upload.originalBase64, "base64"), bytes = Buffer.from(data.upload.base64, "base64");
      let dimensions; let processed;
      try { dimensions = imageSize(original); processed = imageSize(bytes); } catch { throw new Error("Invalid picture."); }
      const mime = dimensions.type === "jpg" ? "image/jpeg" : `image/${dimensions.type}`;
      if (!validCoverFile(mime, original.byteLength, dimensions.width, dimensions.height) || processed.type !== "jpg" || bytes.byteLength > 5 * 1024 * 1024 || processed.width > 1920 || processed.height > 1080 || processed.width <= processed.height) throw new Error("Invalid picture.");
      path = `buy-orders/${row.id}/${crypto.randomUUID()}.jpg`;
      const { error: up } = await sb.storage.from("public-images").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (up) throw new Error("The picture could not be uploaded. Try again.");
    }
    const values = { cover_sector_image_id: path ? null : data.imageId, cover_image_path: path, cover_image_name: path ? data.upload?.fileName : null, cover_uploaded_by: path ? context.userId : null, cover_uploaded_at: path ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { data: saved, error: saveError } = await sb.from("buy_orders").update(values).eq("id", row.id).eq("status", "waiting").eq("updated_at", row.updated_at).select("*").maybeSingle();
    if (saveError || !saved) { if (path) await sb.storage.from("public-images").remove([path]); throw new Error("The picture could not be saved. Refresh and try again."); }
    if (row.cover_image_path && row.cover_image_path !== path) {
      const { error: removal } = await sb.storage.from("public-images").remove([row.cover_image_path]);
      if (removal) throw new Error("The new cover is saved, but the previous picture could not be removed. Please retry.");
    }
    return { cover: await (await (await import("./buy-order-cover.server")).buyOrderCoverResolver(sb))(saved) };
  });