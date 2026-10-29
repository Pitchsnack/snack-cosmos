import { describe, expect, it } from "vitest";
import { sellerReview } from "../../src/lib/one-step.server";

// A seller listing as it is actually stored: owner_stays is "yes"/"no",
// asking_price_band is a band key, and sector lives on the company row.
const hp = (p: Record<string, unknown> = {}) => ({
  id: "h1", startup_id: "s1", ref_no: "PS-1030", description: "Land bank",
  highlights: [], customers_summary: null, deal_type: "Full acquisition",
  owner_stays: "yes", handover_months: 6, asking_price_thb: 45000000,
  asking_price_band: "under_50m", review_checks: [], ...p,
});
const st = (p: Record<string, unknown> = {}) => ({
  id: "s1", startup_name: "Rita Land Co., Ltd.", registered_number: null,
  sector: "Property Development", city: "Bangkok", last_year_revenue: "Below ฿50M",
  year_founded: 2020, website_url: null, email: null, contact_number: null,
  business_address: null, registered_name: null, ...p,
});
const row = (r: [string, string][], label: string) => r.find(([l]) => l === label)?.[1];

const review = (h: any, s: any) => sellerReview(null, h, s, null, []);

describe("seller review rows use the stored vocabulary", () => {
  it("owner stays for six months reads as the handover line", async () => {
    const r = await review(hp(), st());
    expect(row(r.listingRows, "Owner handover")).toBe("Owner stays 6 months after the sale");
    expect(row(r.card.figs, "Owner handover")).toBe("Owner stays 6 months after the sale");
  });
  it("owner leaving reads as leaving at completion", async () => {
    const r = await review(hp({ owner_stays: "no", handover_months: null }), st());
    expect(row(r.listingRows, "Owner handover")).toBe("Owner leaves at completion");
  });
  it("no handover answer reads Not added", async () => {
    const r = await review(hp({ owner_stays: null, handover_months: null }), st());
    expect(row(r.listingRows, "Owner handover")).toBe("Not added");
  });
  it("the stored band key shows the buyer-facing range, not the key", async () => {
    const r = await review(hp(), st());
    expect(row(r.listingRows, "Asking price")).toBe("Under ฿50M");
    expect(row(r.card.figs, "Asking price")).toBe("Under ฿50M");
  });
  it("a missing band key falls back to the amount's own range", async () => {
    const r = await review(hp({ asking_price_band: null, asking_price_thb: 120000000 }), st());
    expect(row(r.listingRows, "Asking price")).toBe("฿100M – 250M");
  });
  it("sector comes from the company row", async () => {
    const r = await review(hp(), st());
    expect(row(r.listingRows, "Sector")).toBe("Property Development");
    expect(r.card.type).toBe("Property Development");
    expect(r.card.sector).toBe("Property Development");
  });
});
