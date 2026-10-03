import { bandText, typeName } from "@/lib/investor-bands";
import type { CardInvestor } from "@/components/marketplace/buyer-browse-card";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Src = {
  id: string; investor_name: string; investor_type: string | null; country: string | null;
  short_description: string | null; preferred_stages?: string[] | null; preferred_industries?: string[] | null;
  aum_band?: string | null; ticket_band?: string | null; revenue_min_band?: string | null; investment_focus?: string[] | null;
};

/** Admin preview of the anonymous card sellers see in Browse investors (same rules as the server). */
export function toHiddenInvestorCard(r: Src): CardInvestor {
  const h = hash(r.id);
  const codeName = typeName(r.investor_type);
  let description = r.short_description ?? null;
  if (description && r.investor_name) {
    const esc = r.investor_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(new RegExp(esc, "gi"), codeName);
  }
  return {
    refNo: `INV-${String(h % 10000).padStart(4, "0")}`,
    codeName, name: null, type: r.investor_type, city: null, country: r.country, description,
    sectors: r.preferred_industries ?? [], stages: r.preferred_stages ?? [], dealTypes: [], geography: (r.investment_focus ?? []).join(", ") || null,
    verified: false, proofOfFunds: false,
    aumLabel: bandText(r.aum_band), ticketLabel: bandText(r.ticket_band), revLabel: bandText(r.revenue_min_band),
    aumBand: r.aum_band ?? null, ticketBand: r.ticket_band ?? null, revBand: r.revenue_min_band ?? null,
  };
}
