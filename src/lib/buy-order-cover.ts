export type CoverPicture = { id: string; sector_key: string; file_name: string; uploaded_at: string; url: string | null };
export type BuyOrderCover = { url: string | null; name: string | null; source: "upload" | "sector" | "drawn"; imageId: string | null };
export const coverUploadAllowed = (control: boolean, role: string | null) => control && role === "admin";
export const validCoverFile = (mime: string, size: number, width: number, height: number) =>
  ["image/jpeg", "image/png", "image/webp"].includes(mime) && size <= 5 * 1024 * 1024 && width >= 1200 && height >= 675 && width > height;
export function resolveBuyOrderCover(images: CoverPicture[] | undefined, sector: string, picked?: string | null, upload?: { url: string | null; name: string | null }): BuyOrderCover {
  if (upload?.url) return { ...upload, source: "upload", imageId: null };
  const own = (images ?? []).filter((i) => i.sector_key === sector).sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at) || a.id.localeCompare(b.id));
  const image = own.find((i) => i.id === picked) ?? own[0];
  return image ? { url: image.url, name: image.file_name, source: "sector", imageId: image.id } : { url: null, name: null, source: "drawn", imageId: null };
}