/**
 * Admin › Paid reports: browser-safe rules shared by the server list and the page.
 * One row per company; queue tiles, Waiting chip and Next step are decided here.
 */
import type { HubKey } from "./reports-hub";

export const PAID_ORDER: HubKey[] = ["verification", "shareholders", "statements", "valuation", "pnl", "risk", "credit"];
export const PAID_NAMES: Record<HubKey, string> = {
  verification: "Company verification", shareholders: "Shareholders", statements: "Financial statements",
  valuation: "Company valuation", pnl: "P&L analysis", risk: "Company risk", credit: "Credit risk",
};
export const PAID_SHORT: Record<HubKey, string> = {
  verification: "Verification", shareholders: "Shareholders", statements: "Financials",
  valuation: "Valuation", pnl: "P&L", risk: "Risk", credit: "Credit risk",
};
/** Reports that can be ordered (Credit risk has no price). */
export const ORDERABLE: HubKey[] = ["verification", "shareholders", "statements", "valuation", "pnl", "risk"];

/** Order kind → the report(s) it buys. Credit risk is never an order. */
export function keysOfKind(kind: string): HubKey[] {
  if (kind === "financials") return ["statements"];
  if (kind === "bundle") return ["statements", "valuation"];
  if (kind === "credit") return [];
  return (PAID_ORDER as string[]).includes(kind) ? [kind as HubKey] : [];
}

export type PaidTile = "needs" | "ready" | "overdue" | "authorised" | "all";
export type PaidSort = "waiting" | "newest" | "az";
export type OrderStatus = "paid" | "generated" | "delivered";

export type PaidOrder = {
  id: string; ref: string; kind: string; key: HubKey; status: OrderStatus; paidAt: string;
  amount: number | null; method: string | null; generatedAt: string | null; deliveredAt: string | null; shares: number;
};

export type DbdCell = {
  /** linked: the company has the stored data; stored: the store has it, the company isn't linked; none: nothing stored. */
  state: "linked" | "stored" | "none" | "no_number";
  how: "extracted" | "linked" | "refreshed" | "manual" | null;
  at: string | null;
  usedBy: string[];
};

export type PaidCompany = {
  startupId: string; name: string; ref: string | null; reg: string | null;
  orders: PaidOrder[]; dbd: DbdCell; latestPaid: string; oldestOpen: string | null;
  produced: HubKey[];
};

export const businessDaysSince = (d: string, now = new Date()) => {
  let n = 0; const x = new Date(d);
  while (x < now) { x.setDate(x.getDate() + 1); if (x > now) break; const w = x.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
};
/** Overdue rule in use today: paid more than 2 business days ago and not authorised. */
export const orderOverdueBy = (o: Pick<PaidOrder, "status" | "paidAt">, now = new Date()) =>
  o.status === "delivered" ? 0 : Math.max(0, businessDaysSince(o.paidAt, now) - 2);

export const hasData = (c: PaidCompany) => c.dbd.state === "linked";
export const allDone = (c: PaidCompany) => c.orders.length > 0 && c.orders.every((o) => o.status === "delivered");
export const readyOrders = (c: PaidCompany) => (hasData(c) ? c.orders.filter((o) => o.status === "generated") : []);
export const overdueDays = (c: PaidCompany, now = new Date()) => Math.max(0, ...c.orders.map((o) => orderOverdueBy(o, now)));

export function inTile(c: PaidCompany, t: PaidTile, now = new Date()) {
  switch (t) {
    case "needs": return !hasData(c) && c.orders.some((o) => o.status === "paid");
    case "ready": return hasData(c) && c.orders.some((o) => o.status === "generated");
    case "overdue": return overdueDays(c, now) > 0;
    case "authorised": return allDone(c);
    default: return true;
  }
}

export type NextStep = { kind: "use" | "extract" | "authorise" | "view" | "open"; n?: number };
export function nextStep(c: PaidCompany): NextStep {
  if (!hasData(c) && c.dbd.state === "stored") return { kind: "use" };
  if (!hasData(c)) return { kind: "extract" };
  const r = readyOrders(c).length;
  if (r) return { kind: "authorise", n: r };
  return allDone(c) ? { kind: "view" } : { kind: "open" };
}

export function waitingChip(c: PaidCompany, now = new Date()): { tone: "red" | "grey" | "green"; text: string } {
  if (allDone(c)) return { tone: "green", text: "Done" };
  const od = overdueDays(c, now);
  if (od) return { tone: "red", text: `Overdue ${od} day${od === 1 ? "" : "s"}` };
  const d = c.oldestOpen ? Math.floor((+now - +new Date(c.oldestOpen)) / 86_400_000) : 0;
  return { tone: "grey", text: d <= 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}` };
}

export function matchesSearch(c: PaidCompany, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const digits = s.replace(/\D/g, "");
  return c.name.toLowerCase().includes(s) || (c.ref ?? "").toLowerCase().includes(s)
    || c.orders.some((o) => o.ref.toLowerCase().includes(s)) || (!!digits && digits.length >= 4 && (c.reg ?? "").includes(digits));
}

export function sortCompanies(list: PaidCompany[], sort: PaidSort) {
  const l = list.slice();
  if (sort === "az") return l.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "newest") return l.sort((a, b) => b.latestPaid.localeCompare(a.latestPaid));
  // Waiting longest first; companies with nothing open go last.
  return l.sort((a, b) => (a.oldestOpen ?? "9999").localeCompare(b.oldestOpen ?? "9999") || a.name.localeCompare(b.name));
}

export const PAGE_SIZE = 25;

export type AdminViewStatus = { tone: "red" | "amber" | "green" | "grey"; text: string };
/** Status line for one report in the Admin view's left list. */
export function adminViewStatus(c: PaidCompany, key: HubKey): AdminViewStatus {
  const o = c.orders.find((x) => x.key === key);
  if (key === "credit") return hasData(c) ? { tone: "grey", text: "Ready · price not set" } : { tone: "grey", text: "No data yet" };
  if (o) {
    if (o.status === "delivered") return o.shares ? { tone: "green", text: `Shared with ${o.shares}` } : { tone: "green", text: "Authorised" };
    if (!hasData(c)) return { tone: "red", text: "Waiting for data" };
    if (o.status === "generated") return { tone: "amber", text: "Ready to authorise" };
    return { tone: "red", text: "Waiting for data" };
  }
  if (hasData(c) && c.produced.includes(key)) return { tone: "grey", text: "Ready · not ordered" };
  return { tone: "grey", text: "No data yet" };
}
