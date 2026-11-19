import { describe, expect, it } from "vitest";
import {
  capGeneratedListingText,
  isTranslatedListingText,
  planListingTextSave,
  withoutListingTextTranslation,
} from "@/lib/listing-text-translations";

describe("seller listing text translations", () => {
  it("translates the empty language without changing the seller's source", () => {
    const plan = planListingTextSave(null, { headlineTh: "ธุรกิจยานยนต์ในกรุงเทพฯ" });
    expect(plan.headlineTh).toBe("ธุรกิจยานยนต์ในกรุงเทพฯ");
    expect(plan.jobs).toEqual([{ field: "headline", sourceLang: "th", target: "en", source: "ธุรกิจยานยนต์ในกรุงเทพฯ" }]);
  });

  it("replaces an untouched automatic target when its source changes", () => {
    const plan = planListingTextSave(
      { headline: "Old headline", headline_th: "หัวข้อเดิม", translations: [{ field: "headline", target: "th", source: "Old headline" }] },
      { headline: "Seller's new headline" },
    );
    expect(plan.jobs).toEqual([{ field: "headline", sourceLang: "en", target: "th", source: "Seller's new headline" }]);
    expect(plan.translations).toEqual([]);
  });

  it("never replaces the other language after the seller edits it", () => {
    const plan = planListingTextSave(
      { headline: "Old headline", headline_th: "คำแปลของฉัน", translations: [] },
      { headline: "Seller's new headline" },
    );
    expect(plan.headlineTh).toBe("คำแปลของฉัน");
    expect(plan.jobs).toEqual([]);
  });

  it("clears the automatic mark as soon as the target is edited", () => {
    const marks = [{ field: "description", target: "en", source: "คำอธิบาย" }] as const;
    expect(withoutListingTextTranslation(marks, "description", "en")).toEqual([]);
    expect(isTranslatedListingText({ description: "Translated", descriptionTh: "คำอธิบาย", translations: marks }, "description", "en")).toBe(true);
  });

  it("caps generated headlines and descriptions at the field limits", () => {
    expect(capGeneratedListingText("headline", "en", Array.from({ length: 20 }, (_, i) => `word${i + 1}`).join(" ")).split(" ")).toHaveLength(15);
    expect(capGeneratedListingText("headline", "th", "ก".repeat(120))).toHaveLength(100);
    expect(capGeneratedListingText("description", "en", "a".repeat(500))).toHaveLength(420);
  });
});
