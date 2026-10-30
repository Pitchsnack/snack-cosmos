/** Shared Sector images processing: validate, strip metadata and fit 1920 × 1080. */
import { validCoverFile } from "@/lib/buy-order-cover";
async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export async function prepareSectorPicture(file: File, jpegOnly = false) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return null;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  if (!validCoverFile(file.type, file.size, bmp.width, bmp.height)) { bmp.close(); return null; }
  const k = Math.min(1, 1920 / bmp.width, 1080 / bmp.height);
  const width = Math.round(bmp.width * k), height = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close(); return null; }
  ctx.drawImage(bmp, 0, 0, width, height); bmp.close();
  const mime: "image/jpeg" | "image/png" = !jpegOnly && file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, mime === "image/jpeg" ? 0.85 : undefined));
  if (!blob || blob.size > 5 * 1024 * 1024) return null;
  return { width, height, mime, base64: await base64(blob), originalBase64: jpegOnly ? await base64(file) : undefined, previewUrl: URL.createObjectURL(blob) };
}