import { describe, expect, it } from "vitest";
import { BO_SECTORS, addMonths, citiesOf, closesInDays, effectiveStatus, matchOf, overlaps, rangeOf, sellerBand } from "@/lib/buy-orders";

describe("buy orders", () => {
  it("has the 28 SET sectors", () => expect(BO_SECTORS).toHaveLength(28));
  it("a range includes its lower edge only", () => {
    expect(overlaps(rangeOf("฿100M – 250M"), rangeOf("฿250M – 1B"))).toBe(false);
    expect(overlaps(rangeOf("฿50M – 250M"), rangeOf("฿100M – 250M"))).toBe(true);
  });
  it("posting on 28 Oct 2026 for 3 months closes 28 Jan 2027", () => expect(addMonths("2026-10-28", 3)).toBe("2027-01-28"));
  it("is closed from its closes_on day", () => {
    const now = Date.parse("2027-01-28T01:00:00+07:00");
    expect(effectiveStatus("posted", "2027-01-28", now)).toBe("closed");
    expect(effectiveStatus("posted", "2027-01-29", now)).toBe("posted");
  });
  it("Closes in shows 1 to 14 days away", () => {
    const now = Date.parse("2026-11-01T10:00:00+07:00");
    expect(closesInDays("2026-11-02", now)).toBe(1);
    expect(closesInDays("2026-11-15", now)).toBe(14);
    expect(closesInDays("2026-11-16", now)).toBeNull();
  });
  it("splits cities at commas, or and หรือ; Any names none", () => {
    expect(citiesOf("Bangkok, Chiang Mai or Chonburi")).toEqual(["Bangkok", "Chiang Mai", "Chonburi"]);
    expect(citiesOf("กรุงเทพ หรือ ชลบุรี")).toEqual(["กรุงเทพ", "ชลบุรี"]);
    expect(citiesOf("Any")).toEqual([]);
  });
  it("matches four checks; Southeast Asia takes any country", () => {
    const m = matchOf({ sector: "Packaging", country: "Thailand", revenue: "฿50M – 100M", dealType: "Minority stake (below 49%)" },
      { sector: "Packaging", location: "Southeast Asia", target_revenue: "฿50M – 250M", deal_types: ["Full acquisition"] });
    expect(m.n).toBe(3);
    expect(sellerBand("Below ฿50M")?.label).toBe("Under ฿50M");
  });
});
