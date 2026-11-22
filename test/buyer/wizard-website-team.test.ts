import { describe, expect, it } from "vitest";
import { stepsFor, normalizeBuyerReached, buyerWebValid, buyerListingValid, teamHasName, buyerSkips, buyerProgressFor } from "@/lib/buyer-wizard";
import { buyerSetupDescriptionsComplete } from "@/lib/buyer-description";

describe("buyer wizard: Industries first, Website with descriptions, Team", () => {
  it("firm buyer order has 13 steps with Listing after Team and before Review", () => {
    expect(stepsFor("corporate").map((s) => s.id)).toEqual(["role", "type", "name", "sectors", "web", "aum", "ticket", "rev", "deals", "photos", "team", "listing", "review"]);
  });
  it("no buyer has a separate Description step; descriptions live on the Website page", () => {
    expect(stepsFor("agent").some((s) => s.id === "desc")).toBe(false);
    expect(stepsFor("individual").some((s) => s.id === "desc")).toBe(false);
    expect(stepsFor("individual").slice(-3).map((s) => s.id)).toEqual(["team", "listing", "review"]);
  });
  it("maps old furthest steps: Industries -> Deal type, Description -> Photos", () => {
    expect(normalizeBuyerReached("corporate", "sectors")).toBe("deals");
    expect(normalizeBuyerReached("corporate", "desc")).toBe("photos");
    expect(normalizeBuyerReached("individual", "desc")).toBe("team");
  });
  it("never skips the confirmed company question and opens there first", () => {
    const skips = buyerSkips(["role", "name", "reg", "year", "address"], { role: "individual", type: "Individual Investor", web: "www.example.com", year: "2012", name: "Example Co.", nameDone: true });
    expect(skips.has("name")).toBe(false);
    expect(buyerProgressFor("individual", { wizard: { from_signup: ["role", "name", "reg", "year", "address"] } }).first).toBe("name");
  });
  it("Website Short no longer rejects the firm name; the long one still passes only within 80 words", () => {
    expect(buyerWebValid("www.lakeshore.com", "Family office backing Thai firms.", "Its team supports sellers after acquisition.", "Lakeshore", true)).toBe(true);
    expect(buyerWebValid("www.lakeshore.com", "Lakeshore backs Thai firms.", "Its team supports sellers after acquisition.", "Lakeshore", true)).toBe(true);
    expect(buyerWebValid("www.lakeshore.com", "Family office backing Thai firms.", "", "Lakeshore", true)).toBe(false);
    expect(buyerWebValid("www.lakeshore.com", "", Array(81).fill("word").join(" "), "Lakeshore", true)).toBe(false);
  });
  it("Finish requires both the short and long descriptions", () => {
    expect(buyerSetupDescriptionsComplete("Short description", "")).toBe(false);
    expect(buyerSetupDescriptionsComplete("", "Long description")).toBe(false);
    expect(buyerSetupDescriptionsComplete("Short description", "Long description")).toBe(true);
  });
  it("Listing Continue checks both languages, including the hidden one", () => {
    const valid = { description: "A long enough English description.", description_th: "คำอธิบายภาษาไทยที่มีความยาวเพียงพอ", suggested_headline: "Thai logistics firms", suggested_headline_th: "บริษัทโลจิสติกส์ไทย" };
    expect(buyerListingValid(valid)).toBe(true);
    expect(buyerListingValid({ ...valid, description_th: "สั้น" })).toBe(false);
    expect(buyerListingValid({ ...valid, suggested_headline_th: "ก".repeat(81) })).toBe(false);
    expect(buyerListingValid({ ...valid, description_th: "", suggested_headline_th: "" })).toBe(true);
  });
  it("Team needs at least one full name", () => {
    expect(teamHasName([{ name: " " }])).toBe(false);
    expect(teamHasName([{ name: "Dan Antakon" }])).toBe(true);
  });
});
