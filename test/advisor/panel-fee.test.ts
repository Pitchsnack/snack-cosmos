import { describe, expect, it } from "vitest";
import { panelFeeLines } from "../../src/lib/advisor-panel-fee";
import { feeWords, type FeeDetail } from "../../src/lib/advisor-firm";

describe("combined retainer panel presentation", () => {
  const combined: FeeDetail = { type: "retainer_success", amount: "120000", pct: "2–3", words: "" };
  it("splits the English combined fee without changing its stored words", () => {
    expect(panelFeeLines(combined, undefined, false)).toEqual(["Retainer ฿120,000/month", "2–3% success fee"]);
    expect(feeWords(combined)).toBe("Retainer ฿120,000 a month, then a 2–3% success fee");
  });
  it("splits the Thai combined fee with its unchanged amount and range", () => {
    expect(panelFeeLines(combined, undefined, true)).toEqual(["ค่าบริการรายเดือน ฿120,000", "ค่าธรรมเนียมความสำเร็จ 2–3%"]);
  });
  it("leaves standalone monthly retainers unchanged", () => {
    const monthly = { ...combined, type: "retainer" as const };
    expect(panelFeeLines(monthly, feeWords(monthly) ?? undefined, false)).toBeNull();
    expect(feeWords(monthly)).toBe("Retainer ฿120,000 a month");
  });
  it("adapts Admin canonical words but never parses custom structured fees", () => {
    const words = "Retainer ฿120,000 a month, then a 2–3% success fee";
    expect(panelFeeLines(undefined, words, false)).toEqual(["Retainer ฿120,000/month", "2–3% success fee"]);
    expect(panelFeeLines({ ...combined, type: "other", words }, words, false)).toBeNull();
  });
});