/**
 * Acquisition strategy logos are stored inside the localStorage-backed
 * strategy store, so uploaded/snipped images must be compact. This helper
 * rasterizes the picked File to a downscaled data URL (max 512px, WebP with
 * PNG fallback). Vector/odd formats that the canvas cannot decode fall back
 * to a raw data URL when the file is small enough.
 */

const MAX_DIM = 512;
const MAX_RAW_BYTES = 300 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D unavailable");
      ctx.drawImage(bitmap, 0, 0, w, h);
      const webp = canvas.toDataURL("image/webp", 0.85);
      if (webp.startsWith("data:image/webp")) return webp;
      return canvas.toDataURL("image/png");
    } finally {
      bitmap.close();
    }
  } catch {
    if (file.size <= MAX_RAW_BYTES) return await readAsDataUrl(file);
    throw new Error("Logo image could not be processed. Try a smaller PNG, JPG or WebP.");
  }
}
