import { describe, expect, it } from "vitest";
import { marketMissingCount, sectorMissing } from "@/lib/seller-sector";
import { bizSectors, fits } from "@/lib/match-rules";
import { dimensionTags, similarity } from "@/lib/similarity-map/similarity";
import type { StartupListItem } from "@/lib/startups.functions";
import { toDirectoryProjection, DIRECTORY_PROJECTION_ALLOWLIST } from "@/lib/publication/projection";

describe("seller SET sector", () => {
  it("marks null, empty and blank sectors missing, and a picked sector complete", () => {
    expect(sectorMissing(null)).toBe(true);
    expect(sectorMissing("")).toBe(true);
    expect(sectorMissing("  ")).toBe(true);
    expect(sectorMissing("Packaging")).toBe(false);
  });

  it("replaces the Industry count with one Sector count without blocking Save", () => {
    expect(marketMissingCount(null, false)).toBe(2);
    expect(marketMissingCount("Packaging", false)).toBe(1);
    expect(marketMissingCount(null, true)).toBe(1);
    expect(marketMissingCount("Packaging", true)).toBe(0);
  });

  it("matches a buyer whose mandate includes the seller's SET sector", () => {
    const sectors = bizSectors({ sector: "Packaging" });
    expect(sectors).toEqual(["Packaging"]);
    expect(fits({ sectors: ["Packaging"], dealTypes: [] }, { sectors, dealType: null })).toEqual(["sector"]);
  });

  it("does not match using a retired Industry value", () => {
    const row = { sector: null, industry: "FinTech" };
    expect(bizSectors(row)).toEqual([]);
    expect(fits({ sectors: ["FinTech"], dealTypes: [] }, { sectors: bizSectors(row), dealType: null })).toBeNull();
  });
});

const mapRow = (sector: string | null) => ({ id: "one", sector, product_tags: [], market_tags: [] }) as StartupListItem;

describe("sector similarity and publication", () => {
  it("groups and compares the SET sector", () => {
    expect(dimensionTags(mapRow("Packaging"), "industry")).toEqual(["Packaging"]);
    expect(dimensionTags(mapRow(null), "industry")).toEqual([]);
    expect(similarity(mapRow("Packaging"), { ...mapRow("Packaging"), id: "two" }, "industry")).toBe(1);
    expect(similarity(mapRow("Packaging"), { ...mapRow("Food & Beverage"), id: "two" }, "industry")).toBe(0);
  });

  it("publishes Sector and omits the retired Industry projection", () => {
    const projected = toDirectoryProjection({ id: "one", startup_name: "Company", sector: "Packaging" });
    expect(projected.sector).toBe("Packaging");
    expect(projected).not.toHaveProperty("industry");
    expect(DIRECTORY_PROJECTION_ALLOWLIST).toContain("sector");
    expect(DIRECTORY_PROJECTION_ALLOWLIST).not.toContain("industry");
  });
});
