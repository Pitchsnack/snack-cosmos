import { describe, expect, it } from "vitest";
import { buildPublicListing, listingText } from "@/lib/public-listing";

describe("seller listing tag language fallback", () => {
  const listing = buildPublicListing(
    { startup_name: "Private company", sector: "Automotive", product_tags: [], market_tags: [], product_tags_th: ["รถเช่า"], market_tags_th: ["ลูกค้าองค์กร"] },
    { headline: "Automotive business", description: "Description", product_tags: [], market_tags: [] },
    false,
  );

  it("uses Thai-only tags for English readers when English is empty", () => {
    expect(listingText(listing, "en").productTags).toEqual(["รถเช่า"]);
    expect(listingText(listing, "en").marketTags).toEqual(["ลูกค้าองค์กร"]);
  });

  it("prefers the reader's language when those tags exist", () => {
    const both = { ...listing, productTags: ["Car rental"], marketTags: ["Corporate clients"] };
    expect(listingText(both, "en").productTags).toEqual(["Car rental"]);
    expect(listingText(both, "th").productTags).toEqual(["รถเช่า"]);
  });
});
