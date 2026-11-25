import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/i18n/language";
import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import { FirmCard } from "@/components/advisor/advisor-firm-card";
import { ListingBrowseListRow, InvestorBrowseListRow, FirmBrowseListRow } from "@/components/marketplace/browse-list-rows";
import { SellerOwnerCard, SellerOwnerListRow, sellerOwnerDeal, sellerOwnerListing } from "@/components/my-business/seller-owner-card";
import { BuyerOwnerCard, BuyerOwnerListRow, buyerOwnerInvestor } from "@/components/my-business/buyer-owner-card";
import { advisorOwnerStatus } from "@/lib/owner-status";
import type { StartupListItem } from "@/lib/startups.functions";
import type { HiddenProfileRow } from "@/lib/hidden-profile";
import type { BuyerOrg, BuyerProfile } from "@/lib/buyer-profile";
import type { Data } from "@/components/my-business/buyer-investor-edit";
import type { AdvisorFirm } from "@/lib/advisor-firm";

const seller = {
  id: "seller-1", startup_name: "Seller legal name", registered_name: "Seller legal name", city: "Bangkok", headquarters: "Bangkok",
  company_type: "Manufacturing", year_founded: 2018, company_size: "11-50", last_year_revenue: "฿100–150M", sector: "Industrials",
  product_tags: ["Packaging"], market_tags: ["Thailand"], product_tags_th: [], market_tags_th: [], long_description: "Draft description",
  founder_names: [], related_investors: [],
} as unknown as StartupListItem;
const sellerRow = {
  id: "hidden-1", startup_id: "seller-1", tenant_id: "tenant-1", ref_no: "PS-1001", status: "draft", approval_status: "in_review",
  code_name: "Admin listing name", suggested_listing_name: "Seller listing name", headline: "Seller headline", published_headline: "Admin headline",
  headline_th: "หัวข้อของผู้ขาย", published_headline_th: "หัวข้อของผู้ดูแล", description: "Latest saved description", description_th: "คำอธิบายล่าสุด",
  highlights: [], highlights_th: [], customers_summary: "", customers_summary_th: "", product_tags: ["Packaging"], market_tags: ["Thailand"],
  cover_art: "Manufacturing", cover_image_url: null, public_image_id: null, live: null,
  has_unpublished_changes: false, asking_price: null, asking_price_thb: null, asking_price_band: { key: "b100_300", label: "฿100M–300M", th: "฿100–300 ล้านบาท" },
  deal_type: "Full acquisition", stake_pct: 100, structure: "", reason: "", handover: "", process: "", open_to: [], nda_approver: "admin",
  views: 0, ndas_approved: 0, updated_at: "2026-11-25", published_at: null, unpublished_at: null,
} as unknown as HiddenProfileRow;

const buyer = {
  user_id: "buyer-1", ref_no: "INV-1001", code_name: "", headline: null, description: "Latest buyer description", description_th: "คำอธิบายผู้ซื้อล่าสุด",
  suggested_headline: "Buyer suggestion", suggested_headline_th: "ข้อเสนอของผู้ซื้อ", show_name: false, status: "draft", live_since: null,
  legal_name: null, address: null, city: "Bangkok", country: "Thailand", logo_url: null, private_description: null,
  aum_exact: null, ticket_exact: null, ticket_min: null, ticket_max: null, aum_value: null, track_record: null, decision_process: null,
  pof_verified_at: null, sectors: ["Old sector"], stages: ["Growth"], deal_types: ["Acquisition"], target_size: null, geography: "Thailand",
  people: [], portfolio: [], profile_views_month: 0,
} as BuyerProfile;
const buyerOrg: BuyerOrg = { name: "Buyer legal name", type: "Corporate buyer", website: null, registrationNo: null, verified: true, ndas: 0, lois: 0 };
const buyerData = {
  investor: {
    id: "investor-1", investor_type: "Corporate buyer", acts_for_types: [], preferred_industries: ["Logistics"], preferred_stages: ["Growth"],
    investment_focus_raw: ["Thailand", "Vietnam"], aum_band: "aum_10_25", ticket_band: "ticket_1_5", revenue_min_band: "rev_5_10", city: "Bangkok", country: "Thailand",
  },
  buyer: {
    relation: "corporate", deal_types: ["Full acquisition"], published_headline: "Admin wants to buy", published_headline_th: "ผู้ดูแลต้องการซื้อ",
    suggested_headline: "Buyer suggestion", suggested_headline_th: "ข้อเสนอของผู้ซื้อ", published_listing_name: "Admin investor name", approval_status: "in_review", ref_no: "INV-1001",
  },
} as unknown as Data;

const firm = {
  id: "firm-1", refNo: "ADV-1001", name: "Example Advisory", firmType: "Advisory firm", logoPath: null, logoUrl: null, logoSource: null,
  description: "Latest firm description", descriptionTh: "คำอธิบายบริษัทล่าสุด", yearFounded: 2015, city: "Bangkok", country: "Thailand",
  services: ["Legal"], fees: {}, feeDetails: {}, dealBand: "deal_1_5", teamSize: 12, languages: ["English"], sectors: ["Industrials"],
  legalName: null, thaiName: null, registrationNo: null, addrStreet: null, addrUnit: null, addrDistrict: null, addrProvince: null, addrPostal: null,
  website: null, email: null, phone: null, status: "live", liveSince: "2026-01-01", verifiedAt: "2026-01-02", updatedAt: "2026-11-25",
  verification: { state: "verified", note: null, fields: [], reason: null, declineNote: null }, setupAnswered: [], setupDoneAt: "2026-01-01", wizard: {},
  team: [], credentials: [], documents: [], reviews: [{ id: "review-1", role: "seller", detail: null, service: "Legal", stars: 5, comment: null, at: "2026-01-01" }],
} as AdvisorFirm;

function render(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(<QueryClientProvider client={client}><LanguageProvider>{node}</LanguageProvider></QueryClientProvider>);
}
function expectOrder(html: string, tokens: string[]) {
  const positions = tokens.map((token) => html.indexOf(token));
  expect(positions.every((position) => position >= 0), `Missing part in ${tokens.join(", ")}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}
function expectSharedCardParts(owner: string, browse: string) {
  for (const html of [owner, browse]) {
    expect(html).toContain("data-standard-card");
    expect(html).not.toContain("standard-card-open");
    expectOrder(html, ["standard-card-cover", "standard-card-text", "standard-card-figures", "standard-card-foot"]);
  }
}

const css = readFileSync(new URL("../../src/styles/standard-browse-card.css", import.meta.url), "utf8");

describe("My Company and Browse render the same card and List row", () => {
  it("uses the exact shared closed height and Browse grid gap", () => {
    expect(css).toContain(".standard-card:not(.standard-card-open) { height:451.19px; }");
    expect(css).toContain("gap: 20px");
    expect(css).toContain(".standard-card-foot .standard-card-toggle:only-child { width:100%; }");
  });

  it("renders the seller card and row with the same parts and columns", () => {
    const listing = sellerOwnerListing(seller, sellerRow, true, null);
    const deal = sellerOwnerDeal(sellerRow);
    expectSharedCardParts(render(<SellerOwnerCard s={seller} row={sellerRow} hasFinancials coverUrl={null} onSelect={() => {}} />), render(<StandardListingCard l={listing} deal={deal} publicOnly />));
    const ownerRow = render(<SellerOwnerListRow s={seller} row={sellerRow} hasFinancials coverUrl={null} onOpen={() => {}} />);
    const browseRow = render(<ListingBrowseListRow l={listing} deal={deal} star={<span>Save</span>} onOpen={() => {}} />);
    for (const html of [ownerRow, browseRow]) expectOrder(html, ["h-[54px] w-[96px]", "Admin headline", "flex shrink-0 items-center"]);
    expect(ownerRow).toContain("Pending approval");
    expect(ownerRow).not.toContain("Save");
  });

  it("renders the buyer card and row with the same parts and columns", () => {
    const investor = buyerOwnerInvestor(buyer, buyerOrg, buyerData);
    expectSharedCardParts(render(<BuyerOwnerCard p={buyer} org={buyerOrg} d={buyerData} onClick={() => {}} />), render(<StandardInvestorCard i={investor} />));
    const ownerRow = render(<BuyerOwnerListRow p={buyer} org={buyerOrg} d={buyerData} onOpen={() => {}} />);
    const browseRow = render(<InvestorBrowseListRow i={investor} star={<span>Save</span>} onOpen={() => {}} />);
    for (const html of [ownerRow, browseRow]) expectOrder(html, ["data-connect-cover", "min-w-0 flex-1", "flex shrink-0 items-center"]);
    expect(ownerRow).toContain("Pending approval");
    expect(ownerRow).not.toContain("Save");
  });

  it("renders the advisor card and row with the same parts and columns without covering the logo", () => {
    expectSharedCardParts(render(<FirmCard f={firm} ownerStatus={advisorOwnerStatus(firm)} />), render(<FirmCard f={firm} noStatus lastLogin="today" />));
    const ownerCard = render(<FirmCard f={firm} ownerStatus={advisorOwnerStatus(firm)} />);
    expect(ownerCard).toContain('data-owner-status="live"');
    expect(ownerCard).not.toContain("standard-card-owner-status");
    expect(ownerCard).not.toContain("standard-card-last-login");
    const rating = { n: 1, avg: 5 };
    const ownerRow = render(<FirmBrowseListRow f={firm} rating={rating} ownerStatus="live" onOpen={() => {}} />);
    const browseRow = render(<FirmBrowseListRow f={firm} rating={rating} action={<span>Send enquiry</span>} onOpen={() => {}} />);
    for (const html of [ownerRow, browseRow]) expectOrder(html, ["ADV-1001", "Legal", "5.0", "US$1M"]);
    expect(ownerRow).toContain("Live");
    expect(ownerRow).not.toContain("Send enquiry");
  });
});

describe("Owner card text precedence", () => {
  it("uses Admin's seller name and headline but the latest saved description, never the old live snapshot", () => {
    const listing = sellerOwnerListing(seller, sellerRow, true, null);
    expect(listing.codeName).toBe("Admin listing name");
    expect(listing.headline).toBe("Admin headline");
    expect(listing.description).toBe("Latest saved description");
    expect(listing.description).not.toBe("Old live description");
  });

  it("falls back to the seller's suggestion before Admin has published a headline", () => {
    const draft = { ...sellerRow, published_headline: null } as HiddenProfileRow;
    expect(sellerOwnerListing(seller, draft, false, null).headline).toBe("Seller headline");
  });

  it("uses the seller's newly saved text while a live edit awaits Admin", () => {
    const pending = { ...sellerRow, status: "live", live: { headline: "Old live headline", description: "Old live description" }, has_unpublished_changes: true } as HiddenProfileRow;
    const listing = sellerOwnerListing(seller, pending, true, null);
    expect(listing.codeName).toBe("Seller listing name");
    expect(listing.headline).toBe("Seller headline");
    expect(listing.description).toBe("Latest saved description");
  });

  it("uses Admin's buyer Wants to buy text and latest investor mandate values", () => {
    const investor = buyerOwnerInvestor(buyer, buyerOrg, buyerData);
    expect(investor.publishedHeadline).toBe("Admin wants to buy");
    expect(investor.sectors).toEqual(["Logistics"]);
    expect(investor.description).toBe("Latest buyer description");
  });

  it("falls back to the buyer's own Wants to buy text before publication", () => {
    const draft = { ...buyerData, buyer: { ...buyerData.buyer, published_headline: null, published_headline_th: null } } as Data;
    expect(buyerOwnerInvestor(buyer, buyerOrg, draft).publishedHeadline).toBe("Buyer suggestion");
  });

  it("uses the buyer's newly saved Wants to buy text while a live edit awaits Admin", () => {
    const live = { ...buyer, status: "live" } as BuyerProfile;
    expect(buyerOwnerInvestor(live, buyerOrg, buyerData).publishedHeadline).toBe("Buyer suggestion");
  });
});
