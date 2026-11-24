import { describe, expect, it } from "vitest";
import { ticketRevenueRow } from "./one-step.server";

describe("buyer Revenue vs ticket size", () => {
  it("shows the DBD figure and is never compared", () => {
    const r = ticketRevenueRow("$5M – $20M", { revenueM: 120, revenueYear: "2024", manual: false } as never);
    expect(r.label).toBe("Revenue vs ticket size");
    expect(r.from).toBe("Ticket size $5M – $20M");
    expect(r.found).toContain("in the 2024 accounts filed with DBD");
    expect(r.result).toBe("not_needed");
    expect(r.resultLabel).toBe("Shown, not compared");
  });
  it("reads No filed accounts without DBD revenue", () => {
    const r = ticketRevenueRow(null, null);
    expect(r.found).toBe("No filed accounts");
    expect(r.result).toBe("not_needed");
  });
});
