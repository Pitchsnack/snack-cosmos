import { describe, it, expect } from "vitest";
import { firstBlockingStep, stepLocked } from "@/lib/setup-step-state";
import { emptyDraft, sellerValid } from "@/lib/seller-wizard";

const s = (answered: boolean, state = answered ? "done" : "todo") => ({ answered, state });

describe("no jumping ahead", () => {
  it("locks every step after the first unanswered one", () => {
    const steps = [s(true), s(false, "here"), s(true), s(false)];
    const b = firstBlockingStep(steps);
    expect(b).toBe(1);
    expect([0, 1, 2, 3].map((i) => stepLocked(i, b))).toEqual([false, false, true, true]);
  });
  it("a cleared earlier answer re-locks the later answered steps", () => {
    const b = firstBlockingStep([s(false, "missed"), s(true), s(true)]);
    expect(stepLocked(1, b)).toBe(true);
    expect(stepLocked(2, b)).toBe(true);
  });
  it("nothing locks when all are answered", () => {
    expect(firstBlockingStep([s(true), s(true)])).toBe(-1);
  });
});

describe("seller Company after + Add", () => {
  const base = { ...emptyDraft(), name: "Acme", reg: "0125569028942", addr: { street: "99/59", unit: "", district: "เมืองนนทบุรี", province: "Nonthaburi", postal: "" } };
  it("counts as answered once the company check confirmed it, even without a postcode", () => {
    expect(sellerValid({ ...base, regConfirmed: true }).name).toBe(true);
  });
  it("still needs a postcode when not confirmed", () => {
    expect(sellerValid(base).name).toBe(false);
  });
});
