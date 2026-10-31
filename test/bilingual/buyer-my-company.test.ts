import { describe, expect, it } from "vitest";
import { TH } from "@/i18n/th";

// Buyer My Company / wizard list values and labels (lovable-buyer-english-thai-swapped brief).
describe("buyer My Company Thai texts", () => {
  it("translates the placeholder name for a profile with no name yet", () => {
    expect(TH["New investor profile"]).toBe("โปรไฟล์นักลงทุนใหม่");
  });

  it("translates the wizard's first choice title", () => {
    expect(TH["Individual Investor"]).toBe("นักลงทุนรายบุคคลที่มีความเชี่ยวชาญ");
  });

  it("translates the card's Show more labels", () => {
    expect(TH["Based in"]).toBe("ที่ตั้ง");
    expect(TH["Focus"]).toBe("จุดเน้นการลงทุน");
  });

  it("translates list values used on buyer cards", () => {
    expect(TH["Private equity"]).toBe("ไพรเวทอิควิตี้");
    expect(TH["Thailand"]).toBe("ไทย");
    expect(TH["Bangkok"]).toBeDefined(); // official province name; cards shorten it via shortCityTh
    expect(TH["Greater Mekong"]).toBe("ลุ่มแม่น้ำโขง");
    expect(TH["Southeast Asia"]).toBe("เอเชียตะวันออกเฉียงใต้");
    expect(TH["Majority stake (above 51%)"]).toBe("ถือหุ้นส่วนใหญ่ (มากกว่า 51%)");
    expect(TH["Majority stake (51%+)"]).toBe("ถือหุ้นส่วนใหญ่ (51% ขึ้นไป)");
    expect(TH["Buyout"]).toBe("ซื้อกิจการ (Buyout)");
    expect(TH["Food & Beverage"]).toBe("อาหารและเครื่องดื่ม");
    expect(TH["Information & Communication Technology"]).toBe("เทคโนโลยีสารสนเทศและการสื่อสาร");
  });

  it("translates the remaining investor types and stages", () => {
    expect(TH["Venture capital"]).toBe("เวนเจอร์แคปิทัล");
    expect(TH["Corporate VC"]).toBe("คอร์ปอเรตวีซี");
    expect(TH["Corporate buyer"]).toBe("ผู้ซื้อนิติบุคคล");
    expect(TH["Incubator"]).toBe("ตู้ฟักธุรกิจ");
    expect(TH["Seed"]).toBe("ซีด");
    expect(TH["Early"]).toBe("ระยะแรก");
    expect(TH["Sector Agnostic"]).toBe("ไม่จำกัดอุตสาหกรรม");
  });
});
