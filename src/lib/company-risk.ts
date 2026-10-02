import type { StartupFinancials } from "@/lib/financials.functions";

/**
 * Company Risk (liquidity and debt), computed only from the company's filed
 * DBD statements. DBD filings carry no cash line, loan schedule or cash-flow
 * statement, so those figures are reported as "not in the filing" — never estimated.
 */
export type Level = "Low" | "Guarded" | "Moderate" | "Elevated" | "High";
export const LEVELS: Level[] = ["Low", "Guarded", "Moderate", "Elevated", "High"];

export const SAFE = { current: 1.2, quick: 1.0, shortShare: 0.5, de: 1.0, cover: 3.0 };

export type YearRisk = {
  year: number;
  current: number | null; quick: number | null; workingCapital: number | null;
  shortShare: number | null; de: number | null; cover: number | null;
  currentLiab: number | null; nonCurrentLiab: number | null; equity: number | null;
};

export type RiskReport = {
  year: number | null;
  years: YearRisk[];
  latest: YearRisk | null;
  score: number | null; level: Level | null;
  pillars: { key: "liquidity" | "short" | "long"; label: string; level: Level | null; value: string; note: string }[];
  stress: { label: string; cover: number | null }[];
  questions: string[];
  summary: { title: string; text: string }[];
  gaps: string[];
};

const div = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b);

function val(items: StartupFinancials["income"], code: string, year: number) {
  const r = items.find((i) => i.item_code === code && i.fiscal_year === year);
  return r && typeof r.amount === "number" && Number.isFinite(r.amount) ? r.amount : null;
}

export function yearRisk(d: StartupFinancials, y: number): YearRisk {
  const ca = val(d.position, "total_current_assets", y);
  const inv = val(d.position, "inventories", y);
  const cl = val(d.position, "total_current_liabilities", y);
  const ncl = val(d.position, "total_non_current_liabilities", y);
  const tl = val(d.position, "total_liabilities", y) ?? (cl != null && ncl != null ? cl + ncl : null);
  const eq = val(d.position, "equity", y);
  const pbt = val(d.income, "profit_loss_before_income_tax", y);
  const int = val(d.income, "interest_expenses", y);
  return {
    year: y,
    current: div(ca, cl),
    quick: ca != null && cl ? div(ca - (inv ?? 0), cl) : null,
    workingCapital: ca != null && cl != null ? ca - cl : null,
    shortShare: div(cl, tl),
    de: eq != null && eq > 0 ? div(tl, eq) : null,
    cover: pbt != null && int ? (pbt + int) / int : null,
    currentLiab: cl, nonCurrentLiab: ncl, equity: eq,
  };
}

/** 0 = safest, 100 = riskiest, per measure. */
const scoreLow = (v: number | null, safe: number, bad: number) => v == null ? null : Math.max(0, Math.min(100, ((safe * 1.5 - v) / (safe * 1.5 - bad)) * 100));
const scoreHigh = (v: number | null, safe: number, bad: number) => v == null ? null : Math.max(0, Math.min(100, ((v - safe * 0.5) / (bad - safe * 0.5)) * 100));
const levelOf = (s: number | null): Level | null => s == null ? null : LEVELS[Math.min(4, Math.floor(s / 20))];
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

export const x = (v: number | null, d = 2) => (v == null ? "—" : `${v.toFixed(d)}×`);
export const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const mBaht = (v: number | null) => (v == null ? "—" : `฿${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: v !== 0 && Math.abs(v) < 1e7 ? 1 : 0 })}M`);

export function buildRiskReport(d: StartupFinancials, year?: number): RiskReport {
  const ys = [...d.years].sort((a, b) => a - b);
  const years = ys.map((y) => yearRisk(d, y));
  const yr = year != null && ys.includes(year) ? year : ys[ys.length - 1] ?? null;
  const L = years.find((r) => r.year === yr) ?? null;
  const gaps = ["Cash balance, bank loans and their due dates are not in DBD filings, so cash runway and a maturity ladder are not shown.", "DBD filings have no cash-flow statement or depreciation, so debt service cover is not shown."];
  if (!L) return { year: null, years, latest: null, score: null, level: null, pillars: [], stress: [], questions: [], summary: [], gaps };

  const sLiq = avg([scoreLow(L.current, SAFE.current, 0.8), scoreLow(L.quick, SAFE.quick, 0.5)]);
  const sShort = avg([scoreHigh(L.shortShare, SAFE.shortShare, 0.9), L.workingCapital != null && L.workingCapital < 0 ? 100 : null]);
  const sLong = avg([scoreHigh(L.de, SAFE.de, 2.5), scoreLow(L.cover, SAFE.cover, 1.0)]);
  const score = avg([sLiq, sShort, sLong]);

  const pillars: RiskReport["pillars"] = [
    { key: "liquidity", label: "Liquidity", level: levelOf(sLiq), value: `Current ${x(L.current)}`, note: `Quick ratio ${x(L.quick)} · safe above ${SAFE.current}× and ${SAFE.quick}×` },
    { key: "short", label: "Short-term debt", level: levelOf(sShort), value: `${mBaht(L.currentLiab)} due within 12 months`, note: `${pct(L.shortShare)} of all liabilities · safe below ${pct(SAFE.shortShare)}` },
    { key: "long", label: "Long-term debt", level: levelOf(sLong), value: mBaht(L.nonCurrentLiab), note: `Liabilities to equity ${x(L.de)} · interest cover ${x(L.cover, 1)}` },
  ];

  const pbt = val(d.income, "profit_loss_before_income_tax", yr!);
  const int = val(d.income, "interest_expenses", yr!);
  const ebit = pbt != null && int != null ? pbt + int : null;
  const cov = (e: number | null, i: number | null) => (e != null && i ? e / i : null);
  const stress = [
    { label: "As filed", cover: cov(ebit, int) },
    { label: "Interest cost +50%", cover: cov(ebit, int != null ? int * 1.5 : null) },
    { label: "Operating profit −30%", cover: cov(ebit != null ? ebit * 0.7 : null, int) },
    { label: "Both together", cover: cov(ebit != null ? ebit * 0.7 : null, int != null ? int * 1.5 : null) },
  ];

  const questions: string[] = [];
  if ((L.shortShare ?? 0) > SAFE.shortShare) questions.push(`${pct(L.shortShare)} of liabilities fall due within a year. Which bank lines renew, and when?`);
  if ((L.current ?? 9) < SAFE.current) questions.push(`Current assets cover short-term liabilities only ${x(L.current)}. How is the gap funded?`);
  if ((L.cover ?? 9) < SAFE.cover) questions.push(`Operating profit covers interest ${x(L.cover, 1)}. What happens if rates rise?`);
  if ((L.de ?? 0) > SAFE.de) questions.push(`Liabilities are ${x(L.de)} equity. Will any debt be repaid at the sale?`);
  if (!questions.length) questions.push("How much cash does the business hold today, and is any of it restricted?", "Are there guarantees or leases not shown on the balance sheet?");

  const prev = years.find((r) => r.year === yr! - 1) ?? null;
  const trend = (a: number | null, b: number | null, up: string, down: string) => (a == null || b == null ? "" : a > b ? ` ${up}` : a < b ? ` ${down}` : "");
  const summary = [
    { title: "Liquidity", text: `Current assets cover short-term liabilities ${x(L.current)} (quick ratio ${x(L.quick)}), ${(L.current ?? 0) >= SAFE.current ? "above" : "below"} the ${SAFE.current}× safe level.${trend(L.current, prev?.current ?? null, `Up from ${x(prev?.current ?? null)} a year earlier.`, `Down from ${x(prev?.current ?? null)} a year earlier.`)} Working capital is ${mBaht(L.workingCapital)}.` },
    { title: "Debt", text: `${pct(L.shortShare)} of liabilities (${mBaht(L.currentLiab)}) fall due within 12 months and ${mBaht(L.nonCurrentLiab)} later. Liabilities are ${x(L.de)} equity and operating profit covers interest ${x(L.cover, 1)}.` },
    { title: "Stress test", text: stress[3].cover == null ? "No interest cost was filed, so the stress test does not apply." : `If operating profit fell 30% and interest cost rose 50%, interest cover would be ${x(stress[3].cover, 1)}, ${stress[3].cover >= SAFE.cover ? "still above" : "below"} the ${SAFE.cover}× safe level.` },
  ];

  return { year: yr, years, latest: L, score: score == null ? null : Math.round(score), level: levelOf(score), pillars, stress, questions: questions.slice(0, 3), summary, gaps };
}
