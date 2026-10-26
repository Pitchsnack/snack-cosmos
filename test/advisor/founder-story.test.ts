import { describe, it, expect } from "vitest";
import { initialFounderStory, composeFounderBio, plainStoryPart, FounderStorySchema, founderRevenueLabel } from "../../src/lib/founder-story";

describe("founder story rules", () => {
  it("prefills only actual year and sales, without dash spaces", () => {
    const story = initialFounderStory(null, null, "en", "2016", "฿50M – 100M");
    expect(story.parts.year).toBe("2016");
    expect(story.parts.sales).toBe("฿50M–100M");
    expect(story.parts.grew).toBe("");
    expect(initialFounderStory(null, null, "en", "", "").parts.sales).toBe("");
    expect(founderRevenueLabel("฿50M – 100M", "th")).toBe("50–100 ล้านบาท");
  });
  it("keeps legacy bios in own mode without rewriting them", () => {
    const story = initialFounderStory("My original\nwords", null, "th", "2016", "");
    expect(story.mode).toBe("own");
  });
  it("omits each incomplete line from the display bio", () => {
    const story = initialFounderStory(null, null, "en", "2016", "฿50M–100M");
    story.parts.now = "production";
    expect(composeFounderBio(story)).toBe("Still leads production.");
    story.parts.grew = "a business";
    expect(composeFounderBio(story)).toBe("Founded the company in 2016 and developed it into a business.\nStill leads production.");
  });
  it("uses Thai fixed words without translating typed parts", () => {
    const story = initialFounderStory(null, null, "th", "2016", "");
    story.parts.grew = "a business";
    story.parts.now = "production";
    expect(composeFounderBio(story)).toBe("ก่อตั้งบริษัทเมื่อปี 2016 และพัฒนาจนเป็นa business\nปัจจุบันยังคงดูแลproductionโดยตรง");
  });
  it("restores saved parts instead of updating defaults", () => {
    const story = initialFounderStory(null, null, "en", "2016", "");
    story.mode = "own";
    expect(initialFounderStory("own text", story, "th", "2020", "new sales")).toEqual(story);
  });
  it("enforces 120 characters and plain single-line parts", () => {
    expect(plainStoryPart("a\nb\r\nc")).toBe("a b c");
    expect(plainStoryPart("x".repeat(121))).toHaveLength(120);
    const story = initialFounderStory(null, null, "en", "", "");
    story.parts.now = "x".repeat(121);
    expect(FounderStorySchema.safeParse(story).success).toBe(false);
  });
});