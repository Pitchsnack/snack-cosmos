import { SECTOR_AGNOSTIC } from "@/lib/investor-bands";

export type Mandate = { sectors: string[]; dealTypes: string[] };
export type Biz = { sectors: string[]; dealType: string | null };

/** One match rule for both sides of Browse. */
export function fits(m: Mandate, b: Biz): string[] | null {
  const low = (x: string) => x.trim().toLowerCase();
  const ms = m.sectors.map(low);
  const sectorOk = ms.includes(low(SECTOR_AGNOSTIC)) || b.sectors.some((s) => ms.includes(low(s)));
  if (!sectorOk || !b.sectors.length && !ms.includes(low(SECTOR_AGNOSTIC))) return null;
  const crit = ["sector"];
  if (b.dealType && m.dealTypes.length) {
    if (!m.dealTypes.map(low).includes(low(b.dealType))) return null;
    crit.push("deal type");
  }
  return crit;
}

/** Seller matching uses only the SET sector; the retired Industry values never participate. */
export const bizSectors = (s: { sector?: string | null } | null): string[] =>
  s?.sector?.trim() ? [s.sector] : [];
