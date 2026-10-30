import { resolveBuyOrderCover } from "./buy-order-cover";
export async function buyOrderCoverResolver(sb: any) {
  const { data, error } = await sb.from("sector_images").select("id,sector_key,file_name,storage_path,uploaded_at").order("uploaded_at", { ascending: true });
  if (error) throw new Error(error.message);
  const images = data ?? [];
  const cache = new Map<string, Promise<string | null>>();
  const sign = (path: string): Promise<string | null> => {
    const hit = cache.get(path); if (hit) return hit;
    const pending = sb.storage.from("public-images").createSignedUrl(path, 7 * 86400).then((r: any) => r.data?.signedUrl ?? null);
    cache.set(path, pending); return pending;
  };
  return async (row: any) => {
    if (row.cover_image_path) {
      const url = await sign(row.cover_image_path);
      if (url) return resolveBuyOrderCover([], row.sector, null, { url, name: row.cover_image_name });
    }
    const cover = resolveBuyOrderCover(images, row.sector, row.cover_sector_image_id);
    const image = images.find((i: any) => i.id === cover.imageId);
    return { ...cover, url: image ? await sign(image.storage_path) : null };
  };
}