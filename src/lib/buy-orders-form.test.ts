import { describe, expect, it } from "vitest";
import { addMonths, checkDraft, draftRow, emptyDraft } from "./buy-orders";

const ok = { ...emptyDraft(), sector: "Packaging", description: "A regional buyer wants a plant.", targetRevenue: "฿50M – 250M", priceRange: "฿100M – 500M" };

describe("buy order form", () => {
  it("needs industry, target revenue and price range", () => {
    expect(Object.keys(checkDraft(emptyDraft(), false))).toEqual(expect.arrayContaining(["sector", "targetRevenue", "priceRange", "description"]));
  });
  it("description is 10 to 280 characters", () => {
    expect(checkDraft({ ...ok, description: "too short" }, false).description).toBe("description");
    expect(checkDraft({ ...ok, description: "x".repeat(281) }, false).description).toBe("description");
    expect(checkDraft({ ...ok, description: "x".repeat(280) }, false).description).toBeUndefined();
  });
  it("needs at least one deal type", () => {
    expect(checkDraft({ ...ok, dealTypes: [] }, false).dealTypes).toBe("deal");
  });
  it("a sealed buy order needs its buyer", () => {
    expect(checkDraft(ok, true).clientId).toBe("pick");
    expect(checkDraft(ok, false).clientId).toBeUndefined();
  });
  it("empty name and city fall back to the sector and Any", () => {
    const r = draftRow(ok);
    expect(r.name_on_card).toBe("Packaging");
    expect(r.cities).toBe("Any");
  });
  it("posted 28 Oct 2026 for 3 months closes 28 Jan 2027", () => {
    expect(addMonths("2026-10-28", 3)).toBe("2027-01-28");
  });
});
