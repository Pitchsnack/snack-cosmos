import { describe, expect, it } from "vitest";
import { alignedLabelAreaHeights } from "@/lib/field-row-alignment";
import { readFileSync } from "node:fs";

const buyer = readFileSync("src/components/my-business/buyer-investor-edit.tsx", "utf8");

describe("shared profile field-row alignment", () => {
  it("raises the shorter About Company label areas to Region's 30px control top", () => {
    expect(alignedLabelAreaHeights([
      { controlOffset: 24, labelAreaOffset: 0, labelAreaHeight: 24 },
      { controlOffset: 30, labelAreaOffset: 0, labelAreaHeight: 24 },
      { controlOffset: 30, labelAreaOffset: 0, labelAreaHeight: 24 },
    ])).toEqual([30, 24, 24]);
  });

  it("matches the 7.5px Thai Fund's AUM wrap without changing either 8px gap", () => {
    expect(alignedLabelAreaHeights([
      { controlOffset: 39.5, labelAreaOffset: 0, labelAreaHeight: 31.5 },
      { controlOffset: 32, labelAreaOffset: 0, labelAreaHeight: 24 },
    ])).toEqual([31.5, 31.5]);
  });

  it("leaves an already level row and a single stacked field at their natural heights", () => {
    expect(alignedLabelAreaHeights([
      { controlOffset: 32, labelAreaOffset: 0, labelAreaHeight: 24 },
      { controlOffset: 32, labelAreaOffset: 0, labelAreaHeight: 24 },
    ])).toEqual([24, 24]);
    expect(alignedLabelAreaHeights([
      { controlOffset: 32, labelAreaOffset: 0, labelAreaHeight: 24 },
    ])).toEqual([24]);
  });

  it("uses the same CompactFields grid for Investment Mandate", () => {
    expect(buyer).toContain('<CompactFields two className="buyer-mandate-money">');
  });
});
