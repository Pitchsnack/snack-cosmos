import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import { toHiddenInvestorCard } from "@/lib/investor-hidden-card";
import type { InvestorListItem } from "@/lib/investors.functions";

/** Investors Directory: the Browse investor card's private view, from the directory's own authorised row. */
export function DirectoryInvestorCard({ i, onClick }: { i: InvestorListItem; onClick: () => void }) {
  const priv = {
    investor_name: i.investor_name, investor_type: i.investor_type, acts_for_types: i.acts_for_types ?? [], country: i.country, city: null,
    website_url: i.website_url, linkedin_url: i.linkedin_url, email: null, year_founded: null,
    aum: i.aum, min_ticket_size: i.min_ticket_size, max_ticket_size: i.max_ticket_size, revenue_min_m: null, revenue_max_m: null,
    short_description: i.short_description, long_description: i.long_description, keywords: i.keywords, investment_focus: [],
    preferred_stages: i.preferred_stages, preferred_industries: i.preferred_industries, logo_signed_url: i.logo_signed_url,
    aum_band: null, ticket_band: null, revenue_min_band: null, people: [], media: [], linked_startups: [],
  };
  return <StandardInvestorCard i={toHiddenInvestorCard(i)} privateData={priv} hideStatus onClick={onClick} />;
}
