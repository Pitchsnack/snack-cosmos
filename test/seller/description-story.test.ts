import { describe, expect, it } from "vitest";
import {
  applyDescriptionAnswers,
  composeDescription,
  descriptionStoryAnswers,
  descriptionStoryLines,
  initialDescriptionStory,
  isDescriptionStoryTranslated,
  planDescriptionPartSave,
  typeDescriptionPart,
  type DescriptionStory,
} from "@/lib/description-story";
import { sellerListingSource, withAutomaticSellerListingText } from "@/lib/seller-listing-text";
import type { ListingSource } from "@/lib/public-listing";

const source: ListingSource = {
  startup_name: "Acme Ventures",
  sector: "Food & Beverage",
  city: "Chiang Mai, Thailand",
  year_founded: 2018,
  company_size: "11-50",
  last_year_revenue: "THB 10M-30M",
  product_tags: ["Bakery", "Café"],
  market_tags: ["Retail", "Tourists"],
  product_tags_th: [],
  market_tags_th: [],
  regulatory_licenses: [{ name: "FDA" }],
  iso_standards: ["ISO 22000"],
};
const handover = { stays: "yes" as const, months: 6 };
const story = () => initialDescriptionStory("", null, "en", source, handover);

describe("seller Description sentences", () => {
  it("fills all five English lines from answers and joins the buyer text", () => {
    const value = story();
    expect(value.parts).toMatchObject({
      what: "A food & beverage SME", where: "Chiang Mai", year: "2018",
      offer: "Bakery and Café", who: "Retail and Tourists", sales: "THB 10M–30M",
      staff: "11–50", licences: "FDA and ISO 22000", months: "6 months",
    });
    expect(composeDescription(value)).toBe("A food & beverage SME based in Chiang Mai, operating since 2018. Offers Bakery and Café to Retail and Tourists. Annual sales of THB 10M–30M, with 11–50 employees. Holds FDA and ISO 22000. The owner will stay 6 months after the sale to hand over.");
    expect(descriptionStoryLines("en", handover)).toHaveLength(5);
  });

  it("uses the exact Thai fixed wording and localizable answers", () => {
    const th = initialDescriptionStory("", null, "th", { ...source, sector: "Technology & Software" }, handover);
    expect(th.parts.what).toContain("SME");
    expect(th.parts.where).toBe("เชียงใหม่");
    expect(th.parts.months).toBe("6 เดือน");
    expect(composeDescription(th)).toContain("ดำเนินงานมาตั้งแต่ปี 2018");
    expect(composeDescription(th)).toContain("เจ้าของจะอยู่ช่วยส่งมอบงาน 6 เดือน หลังการขาย");
  });

  it("reads Thai tags from the Thai columns and queues their English twins", () => {
    const thaiOnly = { ...source, product_tags: [], market_tags: [], product_tags_th: ["รถยนต์นั่ง"], market_tags_th: ["ตัวแทนจำหน่ายรถยนต์"] };
    const en = initialDescriptionStory("", null, "en", thaiOnly, handover);
    const th = initialDescriptionStory("", null, "th", thaiOnly, handover);
    expect(th.parts.offer).toBe("รถยนต์นั่ง");
    expect(th.parts.who).toBe("ตัวแทนจำหน่ายรถยนต์");
    const plan = planDescriptionPartSave({ en, th }, { en, th });
    expect(plan.jobs).toContainEqual({ key: "offer", sourceLang: "th", target: "en", source: "รถยนต์นั่ง" });
    expect(plan.jobs).toContainEqual({ key: "who", sourceLang: "th", target: "en", source: "ตัวแทนจำหน่ายรถยนต์" });
  });

  it("omits incomplete, no-licence and unanswered-handover lines", () => {
    const incomplete = initialDescriptionStory("", null, "en", {
      ...source, city: null, product_tags: [], product_tags_th: [], regulatory_licenses: [], iso_standards: [],
    }, { stays: null });
    expect(composeDescription(incomplete)).toBe("Offers Bakery and Café to Retail and Tourists.".replace("Offers Bakery and Café to Retail and Tourists.", "Annual sales of THB 10M–30M, with 11–50 employees."));
    expect(composeDescription(incomplete)).not.toContain("Holds");
    expect(composeDescription(incomplete)).not.toContain("owner");
  });

  it("uses the fixed no-handover sentence and omits its months part", () => {
    const no = initialDescriptionStory("", null, "en", source, { stays: "no" });
    expect(composeDescription(no)).toContain("The owner leaves at completion.");
    expect(composeDescription(no)).not.toContain("after the sale");
  });

  it("keeps seller-written Descriptions in their own-words mode", () => {
    const own = initialDescriptionStory("My own description", null, "en", source, handover);
    expect(own.mode).toBe("own");
    expect(own.parts.what).toBe("A food & beverage SME"); // Ready if the seller switches back to sentences.
  });

  it("protects typed parts from later answer fills", () => {
    const typed = typeDescriptionPart(story(), "where", "My chosen place");
    const filled = applyDescriptionAnswers(typed, descriptionStoryAnswers(source, "en", handover), handover);
    expect(filled.parts.where).toBe("My chosen place");
  });

  it("translates only the blank twin and marks its source part", () => {
    const en = story();
    const th = initialDescriptionStory("", null, "th", { ...source, product_tags: [], market_tags: [] }, handover);
    const plan = planDescriptionPartSave({}, { en, th });
    expect(plan.jobs.filter(job => job.target === "th").map(job => job.key)).toContain("offer");
    expect(plan.jobs.filter(job => job.target === "en")).toHaveLength(0);
    const translated = {
      en,
      th: { ...th, parts: { ...th.parts, offer: "เบเกอรี่และคาเฟ่" }, translations: [{ key: "offer" as const, source: en.parts.offer }] },
    };
    expect(isDescriptionStoryTranslated(translated, "th")).toBe(true);
    expect(isDescriptionStoryTranslated(translated, "en")).toBe(false);
  });

  it("retranslates an automatic part when answer synchronisation clears its wrong-language twin", () => {
    const en = story();
    const oldTh = { ...initialDescriptionStory("", null, "th", source, handover), translations: [{ key: "offer" as const, source: "Bakery and Café" }] };
    const clearedTh = { ...oldTh, parts: { ...oldTh.parts, offer: "" } };
    const plan = planDescriptionPartSave({ en, th: oldTh }, { en, th: clearedTh });
    expect(plan.jobs).toContainEqual({ key: "offer", sourceLang: "en", target: "th", source: "Bakery and Café" });
  });

  it("keeps a deliberately cleared part empty and omits its line", () => {
    const cleared = typeDescriptionPart(story(), "offer", "");
    const filled = applyDescriptionAnswers(cleared, descriptionStoryAnswers(source, "en", handover), handover);
    expect(filled.parts.offer).toBe("");
    expect(composeDescription(filled)).not.toContain("Offers");
    const th = initialDescriptionStory("", null, "th", source, handover);
    const plan = planDescriptionPartSave({ en: story(), th }, { en: cleared, th });
    expect(plan.jobs.filter(job => job.key === "offer")).toHaveLength(0);
  });

  it("does not overwrite a manually edited translation", () => {
    const en = story();
    const th = initialDescriptionStory("", null, "th", source, handover);
    const manualTh = typeDescriptionPart(th, "offer", "ข้อความของฉัน");
    const changedEn = typeDescriptionPart(en, "offer", "New offer");
    const plan = planDescriptionPartSave({ en, th }, { en: changedEn, th: manualTh });
    expect(plan.jobs.filter(job => job.key === "offer" && job.target === "th")).toHaveLength(0);
  });
});

describe("seller listing validation fallback", () => {
  it("keeps language-specific tag answers separate", () => {
    const mapped = sellerListingSource({
      name: "Test", web: "", city: "Phuket", year: "2020", size: "1-10", rev: null, sector: "Retail",
      productTags: [], productTagsTh: ["ค้าปลีก"], marketTags: ["Local"], marketTagsTh: [],
    });
    expect(mapped.product_tags).toEqual([]);
    expect(mapped.product_tags_th).toEqual(["ค้าปลีก"]);
  });

  it("uses the new sentences for a blank Description and includes handover", () => {
    const filled = withAutomaticSellerListingText({
      name: "Test", web: "", city: "Phuket", year: "2020", size: "1-10", rev: "THB 1M-10M", sector: "Retail",
      productTags: ["Fashion"], marketTags: ["Local"], stays: "yes", months: 3,
    });
    expect(filled.description).toContain("operating since 2020");
    expect(filled.description).toContain("The owner will stay 3 months after the sale to hand over.");
    expect(filled.description).not.toContain("customers buying products or services");
  });
});
