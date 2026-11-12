import { describe, it, expect } from "vitest";
import { splitThaiAddress } from "@/lib/thai-address";
describe("splitThaiAddress", () => {
  it("splits a Bangkok address", () => {
    expect(splitThaiAddress("99/1 หมู่ที่ 3 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110"))
      .toEqual({ street: "99/1 หมู่ที่ 3 ถนนสุขุมวิท", unit: "แขวงคลองตัน", district: "คลองเตย", province: "Bangkok", postal: "10110" });
  });
  it("splits a provincial address", () => {
    expect(splitThaiAddress("12 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200"))
      .toEqual({ street: "12 ถนนนิมมานเหมินท์", unit: "ตำบลสุเทพ", district: "เมืองเชียงใหม่", province: "Chiang Mai", postal: "50200" });
  });
  it("leaves the postcode empty when missing", () => {
    expect(splitThaiAddress("5 ถนนพระราม 4 แขวงสีลม เขตบางรัก กรุงเทพมหานคร").postal).toBe("");
  });
});
