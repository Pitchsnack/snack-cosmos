import { describe, expect, it } from "vitest";
import { emptyDraft, localizeCard, missingLangs } from "@/lib/buy-orders";

const base = { ...emptyDraft(), sector: "Packaging", name: "Packaging", description: "The buyer wants a packaging firm.", timing: "Soon", mustHave: "A\nB", niceToHave: "" };

describe("buy orders in English and Thai", () => {
  it("posting needs every written text in both languages", () => {
    expect(missingLangs(base).map((m) => m.field)).toEqual(["name", "description", "mustHave", "timing"]);
  });
  it("Must have needs the same number of points in both", () => {
    const d = { ...base, nameTh: "บรรจุภัณฑ์", descriptionTh: "ผู้ซื้อต้องการบริษัทบรรจุภัณฑ์", timingTh: "เร็ว", mustHaveTh: "ก" };
    expect(missingLangs(d)).toEqual([{ field: "mustHave", side: "th" }]);
    expect(missingLangs({ ...d, mustHaveTh: "ก\nข" })).toEqual([]);
  });
  it("Thai readers see the English when a text has no Thai", () => {
    const card = { name: "N", description: "D", products: null, mustHave: ["a"], niceToHave: [], timing: "T", nameTh: "ชื่อ", descriptionTh: null, mustHaveTh: [], niceToHaveTh: [], productsTh: null, timingTh: null };
    const t = localizeCard(card, true);
    expect([t.name, t.description, t.mustHave]).toEqual(["ชื่อ", "D", ["a"]]);
    expect(localizeCard(card, false).name).toBe("N");
  });
});
