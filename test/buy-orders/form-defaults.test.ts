import { describe, expect, it } from "vitest";
import { checkDraft, draftRow, emptyDraft, lines } from "@/lib/buy-orders";
import {
  BO_INDUSTRY_TEXT, buyerPhrase, citiesDisplay, citiesText, defaultDescription, DEFAULT_NICE_TO_HAVE, DEFAULT_TIMING,
  ensureBullets, FEATURED_CITIES, GENERAL_MUST_HAVE, OTHER_PROVINCES, profitLabel, stripBullets, THAI_CITIES,
} from "@/lib/buy-order-defaults";
import { BO_SECTORS } from "@/lib/buy-orders";

describe("buyerPhrase", () => {
  it("uses nationalities with a/an", () => {
    expect(buyerPhrase("South Korea")).toBe("a South Korean company");
    expect(buyerPhrase("Indonesia")).toBe("an Indonesian company");
    expect(buyerPhrase("Thailand")).toBe("a Thai company");
  });
  it("falls back for unknown or missing countries", () => {
    expect(buyerPhrase("Brazil")).toBe("a company from Brazil");
    expect(buyerPhrase(null)).toBe("a company");
  });
});

describe("defaultDescription", () => {
  it("matches the brief's South Korean example (276 characters)", () => {
    const s = defaultDescription({ country: "South Korea", sector: "Electronic Components", location: "Thailand" }, false);
    expect(s).toBe("The buyer is a South Korean company looking for an established electronic components business in Thailand. Preference is for a company with a capable management team, recurring customers, and growth potential. The buyer plans to retain the team and invest in future expansion.");
    expect(s.length).toBe(276);
  });
  it("keeps REITs capitalised and handles no picks", () => {
    expect(defaultDescription({ country: null, sector: "Property Fund & REITs", location: "Thailand" }, false)).toContain("an established property fund & REITs business".replace("property fund & REITs", "property fund & REITs"));
    expect(defaultDescription({ country: null, sector: "", location: "Thailand" }, false)).toContain("The buyer is a company looking for an established business in Thailand.");
  });
  it("writes Thai without ประเทศ before Southeast Asia", () => {
    expect(defaultDescription({ country: "Japan", sector: "", location: "Southeast Asia" }, true)).toContain("จากประเทศญี่ปุ่น");
    expect(defaultDescription({ country: "Japan", sector: "", location: "Southeast Asia" }, true)).toContain("ในเอเชียตะวันออกเฉียงใต้");
    expect(defaultDescription({ country: null, sector: "", location: "Thailand" }, true)).not.toContain("จาก");
  });
});

describe("industry text", () => {
  it("covers all 28 SET sectors with a products line and four points, EN and TH", () => {
    expect(BO_SECTORS).toHaveLength(28);
    for (const s of BO_SECTORS) {
      const t = BO_INDUSTRY_TEXT[s.name];
      expect(t, s.name).toBeTruthy();
      expect(t.products[0].length).toBeGreaterThan(10);
      expect(t.products[1].length).toBeGreaterThan(10);
      expect(t.mustHave[0], s.name).toHaveLength(4);
      expect(t.mustHave[1], s.name).toHaveLength(4);
    }
  });
  it("has the general four points and the two nice-to-haves", () => {
    expect(GENERAL_MUST_HAVE[0]).toHaveLength(4);
    expect(GENERAL_MUST_HAVE[1]).toHaveLength(4);
    expect(DEFAULT_NICE_TO_HAVE[0]).toHaveLength(2);
    expect(DEFAULT_TIMING[0]).toBe("Wants to sign within 6 months");
  });
});

describe("cities", () => {
  it("lists 5 featured cities and 74 other provinces", () => {
    expect(FEATURED_CITIES).toHaveLength(5);
    expect(OTHER_PROVINCES).toHaveLength(74);
    expect(THAI_CITIES).toHaveLength(79);
  });
  it("saves in the list's order with or/and rules", () => {
    expect(citiesText([])).toBe("Any");
    expect(citiesText(["Bangkok"])).toBe("Bangkok");
    expect(citiesText(["Pattaya", "Bangkok"])).toBe("Bangkok or Pattaya");
    expect(citiesText(["Chonburi", "Pattaya", "Bangkok"])).toBe("Bangkok, Pattaya or Chonburi");
  });
  it("shows Thai names joined with หรือ", () => {
    expect(citiesDisplay("Any", true)).toBe("ไม่จำกัด");
    expect(citiesDisplay("Bangkok", true)).toBe("กรุงเทพฯ");
    expect(citiesDisplay("Bangkok, Pattaya or Chonburi", true)).toBe("กรุงเทพฯ พัทยา หรือชลบุรี");
    expect(citiesDisplay("My typed place", true)).toBe("My typed place");
    expect(citiesDisplay("Bangkok or Pattaya", false)).toBe("Bangkok or Pattaya");
  });
});

describe("profit", () => {
  it("labels yes/no and leaves not_stated out", () => {
    expect(profitLabel("yes", false)).toBe("Must be profitable");
    expect(profitLabel("no", false)).toBe("Doesn’t need to be profitable");
    expect(profitLabel("yes", true)).toBe("ต้องมีกำไร");
    expect(profitLabel("not_stated", false)).toBeNull();
    expect(profitLabel(null, false)).toBeNull();
  });
  it("defaults to not_stated and saves only the three choices", () => {
    expect(emptyDraft().profit).toBe("not_stated");
    expect(draftRow({ ...emptyDraft(), profit: "yes" }).profit).toBe("yes");
    expect(draftRow({ ...emptyDraft(), profit: "some free text" }).profit).toBe("not_stated");
  });
});

describe("bullets", () => {
  it("adds bullets, strips them for saving and drops empty points", () => {
    expect(ensureBullets("One\nTwo")).toBe("• One\n• Two");
    expect(stripBullets("• One\n• \n• Two")).toBe("One\nTwo");
    expect(lines("• One\n• Two")).toEqual(["One", "Two"]);
  });
});

describe("description limit", () => {
  const ok = { ...emptyDraft(), sector: "Banking", description: "x".repeat(400), targetRevenue: "Under ฿50M", priceRange: "Under ฿50M" };
  it("takes 10 to 400 characters", () => {
    expect(checkDraft(ok, false).description).toBeUndefined();
    expect(checkDraft({ ...ok, description: "x".repeat(401) }, false).description).toBe("description");
    expect(checkDraft({ ...ok, description: "short" }, false).description).toBe("description");
  });
});
