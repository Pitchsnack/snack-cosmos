import { parseRange, rangeLabel } from "@/lib/investor-browse";
import type { CardInvestor } from "@/components/marketplace/buyer-browse-card";

const BIRDS = ["Heron", "Kestrel", "Falcon", "Osprey", "Egret", "Ibis", "Crane", "Hornbill", "Kingfisher", "Sparrow",
  "Swift", "Plover", "Magpie", "Merlin", "Harrier", "Pelican", "Lark", "Wren", "Starling", "Tern", "Myna", "Bulbul"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Src = {
  id: string; investor_name: string; investor_type: string | null; country: string | null;
  aum: string | null; min_ticket_size?: string | null; max_ticket_size?: string | null;
  short_description: string | null; preferred_stages?: string[] | null; preferred_industries?: string[] | null;
  revenue_min_m?: number | null; revenue_max_m?: number | null;
};

/** Admin preview of the anonymous card sellers see in Browse investors (same rules as the server). */
export function toHiddenInvestorCard(r: Src): CardInvestor {
  const h = hash(r.id);
  const codeName = `Investor ${BIRDS[h % BIRDS.length]}`;
  const aum = parseRange(r.aum);
  const tMin = parseRange(r.min_ticket_size ?? null);
  const tMax = parseRange(r.max_ticket_size ?? null);
  const ticketLo = tMin?.lo ?? null;
  const ticketHi = tMax ? tMax.hi : tMin ? tMin.hi : null;
  let description = r.short_description ?? null;
  if (description && r.investor_name) {
    const esc = r.investor_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(new RegExp(esc, "gi"), codeName);
  }
  return {
    refNo: `INV-${String(h % 10000).padStart(4, "0")}`,
    codeName, name: null, type: r.investor_type, city: null, country: r.country, description,
    sectors: r.preferred_industries ?? [], stages: r.preferred_stages ?? [], dealTypes: [], geography: null,
    verified: false, proofOfFunds: false,
    aumLabel: aum ? rangeLabel(aum.lo, aum.hi) : null,
    ticketLabel: ticketLo == null && !tMax ? null : rangeLabel(ticketLo ?? 0, ticketHi),
    revenueMinM: r.revenue_min_m == null ? null : Number(r.revenue_min_m),
    revenueMaxM: r.revenue_max_m == null ? null : Number(r.revenue_max_m),
  };
}
