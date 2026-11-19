import { describe, expect, it } from "vitest";
import { inferThaiPostalCode } from "@/lib/thai-postal.server";

describe("Thai registered-address postal codes", () => {
  it("resolves แขวงออเงิน เขตสายไหม กรุงเทพมหานคร to 10220", () => {
    expect(inferThaiPostalCode({ subdistrict: "แขวงออเงิน", district: "เขตสายไหม", province: "Bangkok" })).toBe("10220");
  });

  it("accepts abbreviated official address prefixes", () => {
    expect(inferThaiPostalCode({ subdistrict: "ต.แก่งคอย", district: "อ.แก่งคอย", province: "Saraburi" })).toBe("18110");
  });

  it("returns no postcode when the sub-district does not match", () => {
    expect(inferThaiPostalCode({ subdistrict: "แขวงไม่มีในระบบ", district: "สายไหม", province: "Bangkok" })).toBeNull();
  });

  it("returns no postcode for an ambiguous district without a sub-district", () => {
    expect(inferThaiPostalCode({ district: "คลองเตย", province: "Bangkok" })).toBeNull();
  });
});
