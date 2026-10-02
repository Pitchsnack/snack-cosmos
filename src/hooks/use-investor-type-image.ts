import { useInvestorImages } from "@/components/investors/investor-images-menu";
import type { InvestorImage } from "@/lib/investor-images.functions";

/**
 * Cover rule for investor cards: the oldest uploaded image for the investor's type
 * (case-insensitive), else the "Investor" image, else null → drawn cover.
 */
export function resolveInvestorCover(images: InvestorImage[] | undefined, type: string | null | undefined): InvestorImage | null {
  if (!images?.length) return null;
  const t = (type ?? "").trim().toLowerCase();
  const withUrl = images.filter((i) => i.url);
  return withUrl.find((i) => i.type_key.toLowerCase() === t) ?? withUrl.find((i) => i.type_key === "Investor") ?? null;
}

export function useInvestorTypeImage(type: string | null | undefined): string | null {
  const { data } = useInvestorImages();
  return resolveInvestorCover(data, type)?.url ?? null;
}
