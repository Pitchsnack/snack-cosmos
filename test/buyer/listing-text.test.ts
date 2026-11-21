import { describe, expect, it } from "vitest";
import { BUYER_DESCRIPTION_TYPE_WORDS, buyerListingTextLength, writeBuyerListingTexts } from "@/lib/buyer-listing-text";
import { buyerDescriptionError } from "@/lib/buyer-description";

const privateEquity = {
  relation: "corporate" as const,
  type: "Private Equity",
  dealTypes: ["Majority stake (above 51%)"],
  industries: ["Health Care Services", "Information & Communication Technology"],
  geography: ["Thailand"],
  province: "Bangkok",
  country: "Thailand",
  year: "2012",
  ticketBand: "tkt_5_10",
  revenueBand: "rev_3_8",
};

describe("buyer Listing texts", () => {
  it("writes the brief's private-equity example within both limits", () => {
    const text = writeBuyerListingTexts(privateEquity);
    expect(text.want).toBe("Majority stakes in healthcare and technology businesses in Thailand");
    expect(text.wantTh).toBe("การถือหุ้นส่วนใหญ่ในธุรกิจการแพทย์และเทคโนโลยีในประเทศไทย");
    expect(text.description).toBe("A private equity firm based in Bangkok, Thailand, operating since 2012. Invests US$5M–10M per deal in companies with revenue above US$3M.");
    expect(text.descriptionTh).toContain("บริษัทไพรเวทอิควิตี้ในกรุงเทพมหานคร ประเทศไทย");
    expect(buyerListingTextLength(text.want)).toBeLessThanOrEqual(80);
    expect(buyerListingTextLength(text.wantTh)).toBeLessThanOrEqual(80);
    expect(buyerDescriptionError(text.description)).toBeNull();
    expect(buyerDescriptionError(text.descriptionTh)).toBeNull();
  });

  it("writes an Individual Investor without year or minimum revenue", () => {
    const text = writeBuyerListingTexts({ ...privateEquity, relation: "individual", type: "Individual Investor", province: "Chiang Mai", revenueBand: "", dealTypes: ["Minority stake (below 49%)"] });
    expect(text.description).toBe("An individual investor based in Chiang Mai, Thailand. Invests US$5M–10M per deal.");
    expect(text.description).not.toContain("operating since");
    expect(text.descriptionTh).toContain("นักลงทุนรายบุคคลในเชียงใหม่ ประเทศไทย");
  });

  it("handles sector agnostic, global, lowest ticket and highest ticket", () => {
    const global = writeBuyerListingTexts({ ...privateEquity, industries: ["Sector Agnostic"], geography: ["Global"], ticketBand: "tkt_below_5", revenueBand: "rev_below_3" });
    expect(global.want).toBe("Majority stakes in businesses of any industry");
    expect(global.description).toContain("Invests under US$5M per deal.");
    expect(global.description).not.toContain("revenue above");
    const high = writeBuyerListingTexts({ ...privateEquity, ticketBand: "tkt_50_plus" });
    expect(high.description).toContain("Invests over US$50M per deal");
  });

  it("drops extra geographies, industries and deal types in that order to fit 80 characters", () => {
    const text = writeBuyerListingTexts({
      ...privateEquity,
      dealTypes: ["Full acquisition", "Majority stake (above 51%)", "Management buy-in"],
      industries: ["Industrial Materials & Machinery", "Personal Products & Pharmaceuticals", "Information & Communication Technology"],
      geography: ["Thailand", "Vietnam"],
    });
    expect(buyerListingTextLength(text.want)).toBeLessThanOrEqual(80);
    expect(text.want).toContain("Full acquisitions");
    expect(text.want).not.toContain("Vietnam");
  });

  it("writes every investor type as a noun in English and Thai", () => {
    expect(Object.keys(BUYER_DESCRIPTION_TYPE_WORDS).sort()).toEqual(["Corporate Enterprise", "Corporate VC", "Family Office", "Incubator/Accelerator", "Individual Investor", "Private Equity", "Venture Capital"].sort());
    for (const type of Object.keys(BUYER_DESCRIPTION_TYPE_WORDS)) {
      const text = writeBuyerListingTexts({ ...privateEquity, type });
      expect(text.description.length).toBeGreaterThan(20);
      expect(text.descriptionTh.length).toBeGreaterThan(20);
      expect(buyerDescriptionError(text.description)).toBeNull();
      expect(buyerDescriptionError(text.descriptionTh)).toBeNull();
    }
  });

  it("writes an adviser acting for the selected types without a firm name", () => {
    const text = writeBuyerListingTexts({ ...privateEquity, relation: "agent", actsFor: ["Family Office", "Private Equity"] });
    expect(text.description).toContain("An adviser acting for family offices and private equity firms");
    expect(text.descriptionTh).toContain("ที่ปรึกษาแทนแฟมิลี่ออฟฟิศและบริษัทไพรเวทอิควิตี้");
    expect(text.description).not.toContain("Example Capital");
  });
});
