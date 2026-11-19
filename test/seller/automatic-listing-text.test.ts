import { describe, expect, it } from "vitest";
import { suggestBusinessDescription, suggestHeadline } from "@/lib/public-listing";
import { withAutomaticSellerListingText } from "@/lib/seller-listing-text";

const answers = {
  name: "Private Company Co., Ltd.", registeredName: "Private Company Co., Ltd.", web: "https://private.example", city: "Bangkok",
  year: "2020", size: "1-10", rev: "฿100M – 250M", sector: "Automotive", productTags: [], marketTags: [], licences: [], iso: [],
};

describe("automatic seller listing text", () => {
  it("uses An before a vowel sound and stays within 420 characters", () => {
    const description = suggestBusinessDescription(answers);
    expect(description.startsWith("An automotive business")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(420);
  });

  it("caps generated headlines at fifteen words", () => {
    expect(suggestHeadline(answers).trim().split(/\s+/).length).toBeLessThanOrEqual(15);
  });

  it("fills empty fields without overwriting seller-entered text", () => {
    const result = withAutomaticSellerListingText({ ...answers, listingName: "Seller Name", headline: "Seller Headline", description: "Seller Description" });
    expect(result.listingName).toBe("Seller Name");
    expect(result.headline).toBe("Seller Headline");
    expect(result.description).toBe("Seller Description");
    const empty = withAutomaticSellerListingText({ ...answers, listingName: "", headline: "", description: "" });
    expect(empty.listingName).toBeTruthy();
    expect(empty.headline).toBeTruthy();
    expect(empty.description).toBeTruthy();
  });
});
