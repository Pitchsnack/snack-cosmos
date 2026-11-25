import { describe, expect, it } from "vitest";
import { firmCardByline, firmDescriptionLines, type FirmReview } from "@/lib/advisor-firm";

const review = (id: string, stars: number): FirmReview => ({ id, stars, role: "seller", detail: null, service: null, comment: null, at: "2026-11-25T00:00:00Z" });
const firm = {
  firmType: "Advisory firm",
  yearFounded: 2018,
  reviews: [] as FirmReview[],
};

describe("advisor firm card text rules", () => {
  it("shows only firm type and year when there are no reviews", () => {
    expect(firmCardByline(firm)).toBe("Advisory firm · since 2018");
    expect(firmCardByline(firm)).not.toContain("☆");
    expect(firmCardByline(firm)).not.toContain("(0)");
  });

  it("adds the average and count only when reviews exist", () => {
    expect(firmCardByline({ ...firm, firmType: "Law firm", yearFounded: 2020, reviews: [review("1", 4), review("2", 5)] })).toBe("Law firm · since 2020 · ★ 4.5 (2)");
  });

  it("uses the existing interface translation for the year label", () => {
    expect(firmCardByline(firm, (text) => text === "since" ? "ก่อตั้งปี" : text)).toBe("Advisory firm · ก่อตั้งปี 2018");
  });

  it("fits five whole description lines under a one-line name and four under two lines", () => {
    expect(firmDescriptionLines(1)).toBe(5);
    expect(firmDescriptionLines(2)).toBe(4);
  });
});
