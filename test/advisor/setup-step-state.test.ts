import { describe, expect, it } from "vitest";
import { furthestStep, setupAnswered, setupStepState } from "../../src/lib/setup-step-state";
import { stepsFor, buyerSkips, shownSteps } from "../../src/lib/buyer-wizard";

describe("buyer and advisor setup rules", () => {
  const buyer = ["role", "name", "rev", "desc", "review"];
  const advisor = ["type", "name", "deal", "logo", "desc", "review"];
  it("skipped buyer minimum revenue is answered once a later step opens", () => {
    expect(setupAnswered("rev", false, ["rev", "desc"], buyer, "desc")).toBe(true);
  });
  it("skipped buyer description is answered at Review", () => {
    expect(setupStepState("desc", "review", false, ["rev", "desc"], buyer, "review")).toBe("done");
  });
  it("skipped advisor deal size is never red", () => {
    expect(setupStepState("deal", "review", false, ["deal", "logo"], advisor, "review")).toBe("done");
  });
  it("skipped advisor logo is never red", () => {
    expect(setupStepState("logo", "review", false, ["deal", "logo"], advisor, "review")).toBe("done");
  });
  it("jumping ahead makes invalid required questions red, regardless of old answered flags", () => {
    expect(setupStepState("name", "review", false, ["deal", "logo"], advisor, "review")).toBe("missed");
  });
  it("opening previous questions never lowers furthest progress", () => {
    expect(furthestStep(advisor, "review", "name")).toBe("review");
  });
  it("an existing empty progress marker does not mark unreached questions red", () => {
    expect(setupStepState("name", "type", false, [], advisor, null)).toBe("todo");
  });
  it("valid saved answers receive a tick without a Continue flag", () => {
    expect(setupStepState("name", "type", true, [], advisor, null)).toBe("done");
  });
  it("the question on screen wins over saved validity", () => {
    expect(setupStepState("name", "name", true, [], advisor, "review")).toBe("here");
  });
  it("Individual Investors omit type, AUM and firm photos", () => {
    expect(stepsFor("individual").map(s => s.id)).toEqual(["role", "name", "web", "ticket", "rev", "deals", "sectors", "desc", "review"]);
  });
  it("signup-answered questions have no step", () => {
    const skip = buyerSkips(["role", "type", "web", "sectors"], { role:"corporate", type:"Private Equity", web:"https://example.test", year:"2010", name:"Test firm", sectors:["Technology"] });
    expect(shownSteps("corporate", skip).map(s => s.id)).toEqual(["name", "aum", "ticket", "rev", "deals", "photos", "desc", "review"]);
  });
});