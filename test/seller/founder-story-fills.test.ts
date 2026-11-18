import { describe, expect, it } from "vitest";
import { applyStoryFills, initialFounderStory, nowFromPosition, stripIdentifying, typeStoryPart } from "../../src/lib/founder-story";

describe("founder story written from answers", () => {
  it("fills empty parts and marks them auto-filled", () => {
    const s = applyStoryFills(initialFounderStory(null, null, "en", "2025", ""), { grew: "a maker of snacks", who: "restaurants" });
    expect(s.parts.grew).toBe("a maker of snacks");
    expect(s.auto?.grew).toBe(true);
  });
  it("never overwrites a typed part", () => {
    const typed = typeStoryPart(initialFounderStory(null, null, "en", "", ""), "grew", "my words");
    expect(applyStoryFills(typed, { grew: "a maker of snacks" }).parts.grew).toBe("my words");
  });
  it("auto-filled parts follow changed answers", () => {
    const s = applyStoryFills(initialFounderStory(null, null, "en", "", ""), { from: "snacks" });
    expect(applyStoryFills(s, { from: "frozen foods" }).parts.from).toBe("frozen foods");
  });
  it("leaves how many and how long as hints", () => {
    const s = applyStoryFills(initialFounderStory(null, null, "en", "", ""), { top: "5", since: "10" });
    expect(s.parts.top).toBe("");
    expect(s.parts.since).toBe("");
  });
  it("maps Position to what they lead today", () => {
    expect(nowFromPosition("Owner", "en")).toBe("the company as its owner");
    expect(nowFromPosition("Family business owner", "th")).toBe("ธุรกิจครอบครัวในฐานะเจ้าของ");
    expect(nowFromPosition("CEO", "th")).toBe("บริษัทในฐานะซีอีโอ");
  });
  it("removes company name and website", () => {
    expect(stripIdentifying("snacks from Acme Foods via acme.co.th", ["Acme Foods", "acme.co.th"])).not.toMatch(/acme/i);
  });
  it("updates answer-based year and sales when those answers change", () => {
    const original = initialFounderStory(null, null, "en", "2025", "฿50M – 100M");
    const updated = applyStoryFills(original, { year: "2026", sales: "฿100M – 250M" });
    expect(updated.parts.year).toBe("2026");
    expect(updated.parts.sales).toBe("฿100M–250M");
  });
  it("keeps typed year and sales unchanged when answers change", () => {
    const original = initialFounderStory(null, null, "en", "2025", "฿50M – 100M");
    const typedYear = typeStoryPart(original, "year", "2024");
    const typedSales = typeStoryPart(typedYear, "sales", "my sales wording");
    const updated = applyStoryFills(typedSales, { year: "2026", sales: "฿100M – 250M" });
    expect(updated.parts.year).toBe("2024");
    expect(updated.parts.sales).toBe("my sales wording");
  });
  it("removes the website host when the saved answer includes its full URL", () => {
    const result = stripIdentifying("Visit www.acme.co.th or acme.co.th", ["Acme Foods", "https://www.acme.co.th/about"]);
    expect(result).not.toMatch(/acme\.co\.th/i);
  });
});
