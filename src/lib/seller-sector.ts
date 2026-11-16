/** Seller Edit information: Sector is required for completeness, never for Save/Create. */
export function sectorMissing(sector: string | null | undefined): boolean {
  return !sector?.trim();
}

export function marketMissingCount(sector: string | null | undefined, hasProductTags: boolean): number {
  return Number(sectorMissing(sector)) + Number(!hasProductTags);
}
