/**
 * Converts an uploaded picture to WebP in the browser before it is stored.
 * Logos are capped at 800px, photos at 2048px (longest side). SVG and
 * animated GIF are kept as they are; on any failure the original is kept.
 */
export async function toWebp(file: File, kind: "logo" | "photo"): Promise<File> {
  if (typeof document === "undefined") return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  const max = kind === "logo" ? 800 : 2048;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") return file;
    if (file.type === "image/webp" && blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
