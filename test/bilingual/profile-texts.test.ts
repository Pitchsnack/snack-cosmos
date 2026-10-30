import { describe, expect, it } from "bun:test";
import { listingText } from "../../src/lib/public-listing";
import { feeError, feeWords, newFee } from "../../src/lib/advisor-firm";

describe("bilingual profile texts", () => {
  const l = { headline: "Snack maker", description: "Makes snacks", th: { headline: "ผู้ผลิตขนม", description: "", highlights: [], customerProfile: "" } };
  it("Thai readers see the Thai text when it exists", () => {
    expect(listingText(l, "th").headline).toBe("ผู้ผลิตขนม");
  });
  it("Thai readers fall back to the English text per field", () => {
    expect(listingText(l, "th").description).toBe("Makes snacks");
  });
  it("English readers always see the English text", () => {
    expect(listingText(l, "en").headline).toBe("Snack maker");
  });
  it("an advisor fee in Thai own words alone is complete", () => {
    const f = { ...newFee(), type: "other" as const, wordsTh: "ตามตกลง" };
    expect(feeError("M&A advisory", f)).toBeNull();
    expect(feeWords(f)).toBe("ตามตกลง");
  });
});
