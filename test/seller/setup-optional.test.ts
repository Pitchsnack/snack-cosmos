import { describe, expect, it } from "vitest";
import { emptyDraft, sellerAnswered, sellerValid, answeredFlags, isMissed, firstUnanswered, sellerProgress } from "../../src/lib/seller-wizard";

describe("seller optional setup", () => {
  it("a valid website answers Website before passing it", () => {
    expect(sellerAnswered({ ...emptyDraft(), web: "www.example.com", reached: "web" }).web).toBe(true);
  });
  it("an invalid website does not answer Website before passing it", () => {
    expect(sellerAnswered({ ...emptyDraft(), web: "not a website", reached: "web" }).web).toBe(false);
  });
  it("moving past Website counts as answered without enabling URL actions", () => {
    const d = { ...emptyDraft(), reached: "year" };
    expect(sellerAnswered(d).web).toBe(true);
    expect(answeredFlags(d)[2]).toBe(true);
    expect(isMissed("web", d)).toBe(false);
    expect(sellerValid(d).web).toBe(false);
  });
  it("moving past Licences counts as answered without any picks", () => {
    const d = { ...emptyDraft(), reached: "photos" };
    expect(sellerAnswered(d).lic).toBe(true);
    expect(answeredFlags(d)[7]).toBe(true);
    expect(isMissed("lic", d)).toBe(false);
  });
  it("a picked licence answers Licences before passing it", () => {
    expect(sellerAnswered({ ...emptyDraft(), iso: ["ISO 9001"], reached: "lic" }).lic).toBe(true);
  });
  it("required questions passed without answers remain missing", () => {
    expect(isMissed("year", { ...emptyDraft(), reached: "review" })).toBe(true);
  });
  it("resume skips both passed optional questions and opens the next unanswered required step", () => {
    const d = { ...emptyDraft(), role: "owner" as const, name: "Test", reg: "0105561001778", addr: { street: "1", unit: "", district: "Bangkok", province: "Bangkok", postal: "10110" }, reached: "review" };
    expect(firstUnanswered(d)).toBe("year");
    expect(sellerProgress(d)).toEqual({ n: 4, N: 12 });
  });
});