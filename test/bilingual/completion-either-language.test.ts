import { describe, expect, it } from "vitest";
import { buyerCompleteness, type BuyerProfile } from "@/lib/buyer-profile";
import { firmChecklist, type AdvisorFirm } from "@/lib/advisor-firm";
import { sellerDescriptionTagsDone, sellerHeadlineDone } from "@/lib/profile-completeness";

describe("either-language profile completion", () => {
  it("seller counts a Thai headline", () => {
    expect(sellerHeadlineDone({ headline: "", headline_th: "หัวข้อ" })).toBe(true);
    expect(sellerHeadlineDone({ headline: "", headline_th: "" })).toBe(false);
  });
  it("seller counts Thai descriptions and either-language tags", () => {
    expect(sellerDescriptionTagsDone({ short_description: "", short_description_th: "คำอธิบาย", product_tags: [], product_tags_th: ["สินค้า"], market_tags: [], market_tags_th: [] })).toBe(true);
    expect(sellerDescriptionTagsDone({ short_description: "Description", short_description_th: "", product_tags: [], product_tags_th: [], market_tags: ["Thailand"], market_tags_th: [] })).toBe(true);
  });
  it("buyer keeps 30% on Wants to buy and accepts either language", () => {
    const p = { suggested_headline: "", suggested_headline_th: "บริษัทโลจิสติกส์", ticket_min: 1, ticket_max: 2, sectors: ["Logistics"], stages: ["Seed"], deal_types: ["Buyout"], people: [], portfolio: [] } as unknown as BuyerProfile;
    const result = buyerCompleteness(p, null);
    const item = result.items.find((entry) => entry.key === "headline");
    expect(item).toMatchObject({ label: "Wants to buy", weight: 30, done: true });
    expect(result.pct).toBe(65);
  });
  it("buyer does not award the 30% when both Wants to buy columns are empty", () => {
    const p = { suggested_headline: "", suggested_headline_th: "", ticket_min: 1, ticket_max: 2, sectors: ["Logistics"], stages: ["Seed"], deal_types: ["Buyout"], people: [], portfolio: [] } as unknown as BuyerProfile;
    expect(buyerCompleteness(p, null).pct).toBe(35);
  });
  it("advisor counts a Thai-only description", () => {
    const firm = { description: "", descriptionTh: "คำอธิบาย", services: [], fees: {}, team: [], credentials: [] } as unknown as AdvisorFirm;
    expect(firmChecklist(firm).find((item) => item.key === "description")?.done).toBe(true);
  });
});
