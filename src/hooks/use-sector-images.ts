import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSectorImages, type SectorImage } from "@/lib/sector-images.functions";

export const SECTOR_IMAGES_KEY = ["sector-images"] as const;

/** Every sector image (oldest first), shared by all covers and the Sector images page. */
export function useSectorImages() {
  const fn = useServerFn(listSectorImages);
  return useQuery({ queryKey: SECTOR_IMAGES_KEY, queryFn: () => fn(), staleTime: 5 * 60_000 });
}

/**
 * The one cover rule for every listing:
 * 1. the image picked in Set public image, while it still exists and belongs to the listing's sector;
 * 2. else the sector's oldest image;
 * 3. else null → the sector's default (drawn) cover.
 */
export function resolveCover(images: SectorImage[] | undefined, sector: string | null | undefined, publicImageId?: string | null): SectorImage | null {
  if (!images?.length) return null;
  if (publicImageId) {
    const picked = images.find((i) => i.id === publicImageId);
    if (picked && (!sector || picked.sector_key === sector)) return picked;
  }
  if (!sector) return null;
  return images.find((i) => i.sector_key === sector) ?? null;
}
