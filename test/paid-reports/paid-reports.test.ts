import { describe, expect, it } from "vitest";
import { inTile, keysOfKind, nextStep, waitingChip, matchesSearch, sortCompanies, readyOrders, PAID_SHORT, PAGE_SIZE, type PaidCompany, type PaidOrder } from "../../src/lib/paid-reports";

const now = new Date("2026-10-29T03:00:00Z"); // Thursday
const order = (p: Partial<PaidOrder>): PaidOrder => ({ id: "o", ref: "RO-1046", kind: "financials", key: "statements", status: "paid", paidAt: now.toISOString(), amount: 10000, method: "Manual", generatedAt: null, deliveredAt: null, shares: 0, ...p });
const co = (p: Partial<PaidCompany>): PaidCompany => ({ startupId: "s", name: "Sell2 LP", ref: "PS-1026", reg: "0105500010000", orders: [order({})], dbd: { state: "none", how: null, at: null, usedBy: [] }, latestPaid: now.toISOString(), oldestOpen: now.toISOString(), produced: [], ...p });

describe("paid reports rules", () => {
  const storedWithoutOrders = () => co({ orders: [], totalOrders: 0, latestPaid: "", oldestOpen: null, dbd: { state: "linked", how: "extracted", at: now.toISOString(), usedBy: [] } });
  it("linked stored data with zero orders is in no-orders and all, not authorised or waiting", () => {
    const c = storedWithoutOrders();
    expect(inTile(c, "no_orders", now)).toBe(true); expect(inTile(c, "all", now)).toBe(true);
    for (const t of ["needs", "ready", "overdue", "authorised"] as const) expect(inTile(c, t, now)).toBe(false);
  });
  it("orders in any status exclude the no-orders queue", () => {
    expect(inTile({ ...storedWithoutOrders(), totalOrders: 1 }, "no_orders", now)).toBe(false);
  });
  it("unlinked stored records are not data-ready no-orders companies", () => {
    const c = storedWithoutOrders(); expect(inTile({ ...c, dbd: { ...c.dbd, state: "stored" } }, "no_orders", now)).toBe(false);
  });
  it("no-orders companies have no authorisable orders and only view as their next action", () => {
    const c = storedWithoutOrders(); expect(readyOrders(c)).toEqual([]); expect(nextStep(c).kind).toBe("view");
  });
  it("waiting sort uses newest stored DBD date first for zero-order companies", () => {
    const older = { ...storedWithoutOrders(), startupId: "old", dbd: { ...storedWithoutOrders().dbd, at: "2026-10-28T03:00:00Z" } };
    const newer = { ...storedWithoutOrders(), startupId: "new" };
    expect(sortCompanies([older, newer], "waiting").map(c => c.startupId)).toEqual(["new", "old"]);
  });
  it("a newly generated order moves the company from no-orders to ready", () => {
    const c = { ...storedWithoutOrders(), totalOrders: 1, orders: [order({ status: "generated" })] };
    expect(inTile(c, "no_orders", now)).toBe(false); expect(inTile(c, "ready", now)).toBe(true);
  });
  it("server pages remain 25 companies", () => { expect(PAGE_SIZE).toBe(25); });
  it("Credit risk is never an order", () => { expect(keysOfKind("credit")).toEqual([]); });
  it("financials order is Financial statements, short name Financials", () => { expect(keysOfKind("financials")).toEqual(["statements"]); expect(PAID_SHORT.statements).toBe("Financials"); });
  it("nothing stored → Extract data, in Needs DBD data", () => { const c = co({}); expect(nextStep(c).kind).toBe("extract"); expect(inTile(c, "needs", now)).toBe(true); });
  it("store has the number but company not linked → Use stored data", () => { expect(nextStep(co({ dbd: { state: "stored", how: "extracted", at: null, usedBy: ["ADV-1"] } })).kind).toBe("use"); });
  it("linked with 2 ready orders → Authorise 2, in Ready to authorise", () => {
    const c = co({ dbd: { state: "linked", how: "linked", at: null, usedBy: [] }, orders: [order({ status: "generated" }), order({ id: "b", key: "pnl", status: "generated" })] });
    expect(nextStep(c)).toEqual({ kind: "authorise", n: 2 }); expect(inTile(c, "ready", now)).toBe(true);
  });
  it("ready orders without stored data are not authorisable", () => { expect(nextStep(co({ orders: [order({ status: "generated" })] })).kind).toBe("extract"); });
  it("every order delivered → Done and View reports", () => {
    const c = co({ dbd: { state: "linked", how: "extracted", at: null, usedBy: [] }, orders: [order({ status: "delivered" })], oldestOpen: null });
    expect(waitingChip(c, now)).toEqual({ tone: "green", text: "Done" }); expect(nextStep(c).kind).toBe("view"); expect(inTile(c, "authorised", now)).toBe(true);
  });
  it("overdue after 2 business days", () => {
    const paid = "2026-10-23T03:00:00Z"; // Friday → 4 business days by Thursday
    const c = co({ orders: [order({ paidAt: paid })], oldestOpen: paid });
    expect(waitingChip(c, now)).toEqual({ tone: "red", text: "Overdue 2 days" }); expect(inTile(c, "overdue", now)).toBe(true);
  });
  it("search matches name, PS ref, RO ref and registration number", () => {
    const c = co({});
    for (const q of ["sell2", "PS-1026", "ro-1046", "0105500010000"]) expect(matchesSearch(c, q)).toBe(true);
    expect(matchesSearch(c, "parfun")).toBe(false);
  });
});
