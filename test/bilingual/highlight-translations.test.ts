import { describe, expect, it } from "vitest";
import { isTranslatedHighlight, planHighlightSave } from "@/lib/highlight-translations";

describe("Highlight language detection and translation protection", () => {
  it("saves English typed with the app in Thai to English and requests Thai translation", () => {
    const plan = planHighlightSave(null, { th: ["Repeat customers", "Experienced team", "Export ready", ""] });
    expect(plan.en).toEqual(["Repeat customers", "Experienced team", "Export ready", ""]);
    expect(plan.th).toEqual(["", "", "", ""]);
    expect(plan.jobs.map((job) => [job.index, job.target])).toEqual([[0, "th"], [1, "th"], [2, "th"]]);
  });

  it("saves Thai typed with the app in English to Thai and requests English translation", () => {
    const plan = planHighlightSave(null, { en: ["ลูกค้าประจำ", "ทีมงานมีประสบการณ์", "พร้อมส่งออก", ""] });
    expect(plan.th).toEqual(["ลูกค้าประจำ", "ทีมงานมีประสบการณ์", "พร้อมส่งออก", ""]);
    expect(plan.en).toEqual(["", "", "", ""]);
    expect(plan.jobs.every((job) => job.target === "en")).toBe(true);
  });

  it("refreshes an untouched automatic translation when its original changes", () => {
    const plan = planHighlightSave(
      { en: ["Old original"], th: ["คำแปลเก่า"], translations: [{ index: 0, target: "th", source: "Old original" }] },
      { en: ["New original"], th: ["คำแปลเก่า"] },
    );
    expect(plan.jobs).toEqual([{ index: 0, sourceLang: "en", target: "th", text: "New original" }]);
  });

  it("preserves a user-edited translation when its original changes", () => {
    const plan = planHighlightSave(
      { en: ["Old original"], th: ["คำแปลเก่า"], translations: [{ index: 0, target: "th", source: "Old original" }] },
      { en: ["New original"], th: ["คำแปลของฉัน"] },
    );
    expect(plan.th[0]).toBe("คำแปลของฉัน");
    expect(plan.jobs).toEqual([]);
    expect(plan.translations).toEqual([]);
  });

  it("removes the Translated mark as soon as the translated text is edited", () => {
    const current = { en: ["Original"], th: ["คำแปล"], translations: [{ index: 0, target: "th" as const, source: "Original" }] };
    expect(isTranslatedHighlight(current, 0, "th")).toBe(true);
    const plan = planHighlightSave(current, { en: ["Original"], th: ["แก้คำแปลเอง"] });
    expect(isTranslatedHighlight(plan, 0, "th")).toBe(false);
  });

  it("backfills English previously stored in the Thai array by its letters", () => {
    const plan = planHighlightSave({ en: [], th: ["20 years of export experience"], translations: [] }, {});
    expect(plan.en[0]).toBe("20 years of export experience");
    expect(plan.th[0]).toBe("");
    expect(plan.jobs).toEqual([{ index: 0, sourceLang: "en", target: "th", text: "20 years of export experience" }]);
  });

  it("repairs identical non-Thai placeholder translations from the first backfill", () => {
    const plan = planHighlightSave({ en: ["sdfaf"], th: ["sdfaf"], translations: [{ index: 0, target: "en", source: "sdfaf" }] }, {});
    expect(plan.en[0]).toBe("sdfaf");
    expect(plan.th[0]).toBe("");
    expect(plan.jobs).toEqual([{ index: 0, sourceLang: "en", target: "th", text: "sdfaf" }]);
  });

  it("backfills only the missing language and keeps row positions", () => {
    const plan = planHighlightSave({ en: ["", "Second", "", "Fourth"], th: ["", "", "", ""] }, {});
    expect(plan.jobs.map((job) => [job.index, job.target])).toEqual([[1, "th"], [3, "th"]]);
    expect(plan.en).toEqual(["", "Second", "", "Fourth"]);
  });
});
