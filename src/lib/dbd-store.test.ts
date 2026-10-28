import { describe, expect, it } from "vitest";
import { factsFromData, manualToData, normReg } from "./dbd-store.server";

describe("DBD store", () => {
  it("keys records by a 13-digit registration number only", () => {
    expect(normReg("0-1055-55078-06-3")).toBe("0105555078063");
    expect(normReg("12345")).toBeNull();
  });
  it("saves figures entered by hand with their source and the report codes", () => {
    const d = manualToData({ source: "Audited accounts", company: { nameTh: "บริษัท ก" }, years: [{ year: 2024, revenue: 5_000_000, totalAssets: 9 }] });
    expect(d.statements[0].source_name).toBe("Entered by hand · Audited accounts");
    expect(d.statements[0].income.find((r) => r.item_code === "total_revenue")?.amount).toBe(5_000_000);
    expect(factsFromData(d)?.revenueM).toBe(5);
  });
});
