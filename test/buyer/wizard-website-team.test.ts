import { describe, expect, it } from "vitest";
import { stepsFor, normalizeBuyerReached, buyerWebValid, teamHasName } from "@/lib/buyer-wizard";
import { buyerSetupDescriptionsComplete } from "@/lib/buyer-description";

describe("buyer wizard: Industries first, Website with descriptions, Team", () => {
  it("firm buyer order has 12 steps with Industries after Company and Team before Review", () => {
    expect(stepsFor("corporate").map((s) => s.id)).toEqual(["role", "type", "name", "sectors", "web", "aum", "ticket", "rev", "deals", "photos", "team", "review"]);
  });
  it("no buyer has a separate Description step; descriptions live on the Website page", () => {
    expect(stepsFor("agent").some((s) => s.id === "desc")).toBe(false);
    expect(stepsFor("individual").some((s) => s.id === "desc")).toBe(false);
    expect(stepsFor("individual").slice(-2).map((s) => s.id)).toEqual(["team", "review"]);
  });
  it("maps old furthest steps: Industries -> Deal type, Description -> Photos", () => {
    expect(normalizeBuyerReached("corporate", "sectors")).toBe("deals");
    expect(normalizeBuyerReached("corporate", "desc")).toBe("photos");
    expect(normalizeBuyerReached("individual", "desc")).toBe("team");
  });
  it("Website step fails when the short description names the firm or the long one passes 80 words", () => {
    expect(buyerWebValid("www.lakeshore.com", "Family office backing Thai firms.", "", "Lakeshore", true)).toBe(true);
    expect(buyerWebValid("www.lakeshore.com", "Lakeshore backs Thai firms.", "", "Lakeshore", true)).toBe(false);
    expect(buyerWebValid("www.lakeshore.com", "", Array(81).fill("word").join(" "), "Lakeshore", true)).toBe(false);
  });
  it("Finish requires both the short and long descriptions", () => {
    expect(buyerSetupDescriptionsComplete("Short description", "")).toBe(false);
    expect(buyerSetupDescriptionsComplete("", "Long description")).toBe(false);
    expect(buyerSetupDescriptionsComplete("Short description", "Long description")).toBe(true);
  });
  it("Team needs at least one full name", () => {
    expect(teamHasName([{ name: " " }])).toBe(false);
    expect(teamHasName([{ name: "Dan Antakon" }])).toBe(true);
  });
});
