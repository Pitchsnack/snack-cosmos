/**
 * Made-up, internally consistent sample report for "View sample".
 * Never touches real company data; a new pseudonym and figures each time.
 */
import type { ReportData } from "@/lib/pipeline.functions";

export type SampleValuation = {
  low: number; mid: number; high: number;
  ev: number;
  methods: { method: string; basis: string; rate: string; value: string; weight: string; confidence: "High" | "Medium" | "Low" }[];
  multiples: { metric: string; company: string; peerLow: string; peerMedian: string; peerHigh: string; implied: string }[];
  bridge: { label: string; value: number; kind: "start" | "add" | "less" | "total" }[];
  discounts: { label: string; pct: number; note: string }[];
  reportedEbitda: number;
  normalisedEbitda: number;
  earnings: { label: string; amount: number; note: string }[];
  peers: { name: string; revenue: number; growth: number; ebitdaMargin: number; netMargin: number; evEbitda: number }[];
  notes: string[];
};
export type SampleReportData = { company: string; legalName: string; sector: string; data: ReportData; cash: Record<number, number>; debt: Record<number, number>; valuation: SampleValuation };


const NAMES = ["Apex", "Horizon", "Lotus", "Cobalt", "Monsoon", "Saffron", "Teak", "Harbor", "Summit", "Jade"];
const SUFFIX = ["Wave", "Trail", "Foundry", "Peak", "Bridge", "Grove", "Crest"];
const SECTORS = ["B2B SaaS", "Cold-Chain Logistics", "F&B chain", "Healthcare clinics", "E-commerce retail", "Industrial packaging"];
const FIRST = ["Somchai", "Naphat", "Pimchanok", "Thanakorn", "Kanya", "Wichai", "Suphansa", "Chalermpol", "Areeya", "Nattapong"];
const LAST = ["Srisuk", "Wongphan", "Chaiyaporn", "Rattanakul", "Boonmee", "Intharat", "Tangsakul", "Phuwanart", "Siriwat", "Kittisak"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const pickMany = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const M = 1e6;
const fmtM = (v: number) => `฿${Math.round(v / M)}M`;

export function makeSampleReport(): SampleReportData {
  const years = [2021, 2022, 2023, 2024, 2025];
  const income: ReportData["income"] = {};
  const position: ReportData["position"] = {};
  const set = (m: ReportData["income"], k: string, y: number, v: number) => ((m[k] ??= {})[y] = Math.round(v));
  const cash: Record<number, number> = {};
  const debt: Record<number, number> = {};
  let rev = rnd(80, 200) * M;
  const gm = rnd(0.4, 0.62);
  let last = { rev: 0, ebitda: 0, net: 0, assets: 0, equity: 0, liab: 0, ca: 0, cl: 0, ar: 0, inv: 0 };
  for (const y of years) {
    if (y > 2021) rev *= 1 + rnd(0.12, 0.28);
    const gross = rev * (gm + rnd(-0.02, 0.02));
    const ebitda = rev * rnd(0.11, 0.2);
    const interest = rev * rnd(0.004, 0.012);
    const pbt = ebitda - interest - rev * 0.03;
    const tax = Math.max(0, pbt * 0.2);
    const net = pbt - tax;
    const sga = gross - pbt - interest;
    set(income, "revenue_sales_services", y, rev * 0.98);
    set(income, "total_revenue", y, rev);
    set(income, "cost_of_goods_sold", y, rev - gross);
    set(income, "gross_profit_loss", y, gross);
    set(income, "selling_admin_expenses", y, sga);
    set(income, "total_expenses", y, rev - pbt - interest);
    set(income, "interest_expenses", y, interest);
    set(income, "profit_loss_before_income_tax", y, pbt);
    set(income, "income_tax_expense", y, tax);
    set(income, "net_profit_loss", y, net);
    const assets = rev * rnd(0.7, 0.9);
    const ar = rev * 0.14, inv = rev * 0.08, ca = assets * 0.52, cl = ca * rnd(0.4, 0.6);
    const liab = assets * rnd(0.38, 0.5);
    const equity = assets - liab;
    for (const [k, v] of Object.entries({ accounts_receivable: ar, inventories: inv, total_current_assets: ca, property_plant_equipment: assets * 0.36, total_non_current_assets: assets - ca, total_assets: assets, total_current_liabilities: cl, total_non_current_liabilities: liab - cl, total_liabilities: liab, equity, total_liabilities_equity: assets })) set(position, k, y, v);
    cash[y] = Math.round(ca * rnd(0.25, 0.4));
    debt[y] = Math.round(liab * rnd(0.3, 0.5));
    last = { rev, ebitda, net, assets, equity, liab, ca, cl, ar, inv };
  }
  const r = (code: string, label: string, value: number, unit: "percent" | "times") => ({ code, label, value: Math.round(value * 100) / 100, unit });
  const ratios = [
    r("return_on_assets", "Return on Assets (%)", (last.net / last.assets) * 100, "percent"),
    r("return_on_equity", "Return on Equity (%)", (last.net / last.equity) * 100, "percent"),
    r("gross_profit_margin", "Gross Profit Margin (%)", gm * 100, "percent"),
    r("operating_income_on_revenue", "Operating Income on Revenue Ratio (%)", (last.ebitda / last.rev) * 100 - 3, "percent"),
    r("net_profit_margin", "Net Profit Margin (%)", (last.net / last.rev) * 100, "percent"),
    r("current_ratio", "Current Ratio (times)", last.ca / last.cl, "times"),
    r("accounts_receivable_turnover", "Accounts Receivable Turnover (times)", last.rev / last.ar, "times"),
    r("inventory_turnover", "Inventory Turnover (times)", (last.rev * (1 - gm)) / last.inv, "times"),
    r("accounts_payable_turnover", "Accounts Payable Turnover (times)", rnd(6, 10), "times"),
    r("total_assets_turnover", "Total Assets Turnover (times)", last.rev / last.assets, "times"),
    r("operation_expense_to_revenue", "Operation Expense to Total Revenue Ratio (%)", rnd(28, 40), "percent"),
    r("asset_to_equity", "Asset to Equity Ratio or Financial Leverage (times)", last.assets / last.equity, "times"),
    r("debt_to_asset_ratio", "Debt to Asset Ratio (times)", last.liab / last.assets, "times"),
    r("debt_to_equity_ratio", "Debt to Equity Ratio (times)", last.liab / last.equity, "times"),
    r("debt_to_capital_ratio", "Debt to Capital Ratio (times)", last.liab / (last.liab + last.equity), "times"),
  ];
  const lastYear = years[years.length - 1]!;
  const lastCash = cash[lastYear]!;
  const lastDebt = debt[lastYear]!;

  // Earnings normalisation — reported EBITDA adjusted to a buyer-ready figure.
  const earnings = [
    { label: "Owner salary above market", amount: last.rev * rnd(0.004, 0.011), note: "Founder pay restated at a market rate for the role" },
    { label: "Related-party rent", amount: last.rev * rnd(0.002, 0.006), note: "Premises rented from a shareholder, restated at market rent" },
    { label: "One-off legal and advisory", amount: last.rev * rnd(0.001, 0.004), note: "Non-recurring costs in FY25, added back" },
    { label: "Private motor and travel", amount: -last.rev * rnd(0.0005, 0.002), note: "Personal expenses removed from the business" },
  ].map((a) => ({ ...a, amount: Math.round(a.amount) }));
  const reportedEbitda = Math.round(last.ebitda);
  const normalisedEbitda = reportedEbitda + earnings.reduce((s, a) => s + a.amount, 0);

  const mult = rnd(7, 10.5);
  const ev = normalisedEbitda * mult;
  const discounts = [
    { label: "Size discount", pct: Math.round(rnd(6, 12)), note: "Smaller than the listed peer set" },
    { label: "Illiquidity discount", pct: Math.round(rnd(8, 15)), note: "Private shares, no ready market" },
    { label: "Key-person dependency", pct: Math.round(rnd(3, 7)), note: "Founder holds the main customer relationships" },
    { label: "Recurring revenue premium", pct: -Math.round(rnd(3, 6)), note: "Contracted revenue above the peer average" },
  ];
  const factor = discounts.reduce((f, d) => f * (1 - d.pct / 100), 1);
  const equityBefore = ev - lastDebt + lastCash;
  const mid = equityBefore * factor;
  const low = mid * 0.84, high = mid * 1.17;
  const brand = `${pick(NAMES)} ${pick(SUFFIX)}`;
  const company = `Project ${brand}`;
  const legalName = `${brand} (Thailand) Co., Ltd.`;
  const people = pickMany(FIRST, 6).map((f, i) => `${f} ${pickMany(LAST, 6)[i]}`);
  const directorNames = people.slice(0, 3);
  const shareholderNames = [legalName.replace(" Co., Ltd.", " Holdings Co., Ltd."), people[3]!, people[4]!];
  const peerMult = [mult - rnd(1.5, 2.5), mult, mult + rnd(1.5, 3)];
  const peers = ["Siam Vertex PCL", "Chao Phraya Industries", "Asia Meridian Group", "Bangkok Nexus PCL", "Gulf Orchid Holdings"].map((name, i) => ({
    name,
    revenue: Math.round(last.rev * rnd(0.6, 2.4)),
    growth: Math.round(rnd(4, 22) * 10) / 10,
    ebitdaMargin: Math.round(rnd(9, 22) * 10) / 10,
    netMargin: Math.round(rnd(4, 14) * 10) / 10,
    evEbitda: Math.round((peerMult[i % 3]! + rnd(-0.8, 0.8)) * 10) / 10,
  }));
  return {
    company, sector: pick(SECTORS), cash, debt,
    data: {
      years, income, position, ratios, valuationShared: true,
      info: {
        registration: `0105${Math.floor(rnd(550000000, 569999999))}`,
        capital: Math.round(rnd(5, 50)) * M,
        founded: String(2010 + Math.floor(rnd(0, 9))),
        employees: `${Math.round(rnd(60, 260))}`,
        directors: `${Math.round(rnd(2, 5))}`,
        shareholders: `${Math.round(rnd(2, 8))}`,
      },
    },
    valuation: {
      low, mid, high, ev, reportedEbitda, normalisedEbitda, earnings, discounts, peers,
      methods: [
        { method: "Listed peer multiples", basis: `5 SET peers · normalised EBITDA ${fmtM(normalisedEbitda)}`, rate: `${mult.toFixed(1)}× EBITDA`, value: fmtM(ev), weight: "45%", confidence: "High" },
        { method: "Comparable transactions", basis: "6 Thai deals 2024–26", rate: `${(mult - 1).toFixed(1)}× – ${(mult + 1).toFixed(1)}× EBITDA`, value: `${fmtM(normalisedEbitda * (mult - 1))} – ${fmtM(normalisedEbitda * (mult + 1))}`, weight: "30%", confidence: "Medium" },
        { method: "EV / Revenue cross-check", basis: `FY25 revenue ${fmtM(last.rev)}`, rate: `${(ev / last.rev).toFixed(1)}×`, value: `${fmtM(low)} – ${fmtM(high)}`, weight: "15%", confidence: "Medium" },
        { method: "Discounted cash flow", basis: "5-year plan, 14% WACC", rate: "Terminal growth 3%", value: `${fmtM(mid * 0.94)} – ${fmtM(mid * 1.05)}`, weight: "10%", confidence: "Low" },
        { method: "Net asset value", basis: `Equity ${fmtM(last.equity)}`, rate: "1.0× book", value: fmtM(last.equity), weight: "Sense check", confidence: "Low" },
      ],
      multiples: [
        { metric: "EV / EBITDA", company: `${mult.toFixed(1)}×`, peerLow: `${peerMult[0]!.toFixed(1)}×`, peerMedian: `${peerMult[1]!.toFixed(1)}×`, peerHigh: `${peerMult[2]!.toFixed(1)}×`, implied: fmtM(ev) },
        { metric: "EV / Revenue", company: `${(ev / last.rev).toFixed(1)}×`, peerLow: `${(ev / last.rev * 0.7).toFixed(1)}×`, peerMedian: `${(ev / last.rev * 0.95).toFixed(1)}×`, peerHigh: `${(ev / last.rev * 1.4).toFixed(1)}×`, implied: fmtM(ev) },
        { metric: "P / E", company: `${(mid / last.net).toFixed(1)}×`, peerLow: `${(mid / last.net * 0.75).toFixed(1)}×`, peerMedian: `${(mid / last.net * 1.02).toFixed(1)}×`, peerHigh: `${(mid / last.net * 1.35).toFixed(1)}×`, implied: fmtM(mid) },
        { metric: "P / B", company: `${(mid / last.equity).toFixed(1)}×`, peerLow: `${(mid / last.equity * 0.7).toFixed(1)}×`, peerMedian: `${(mid / last.equity * 1.05).toFixed(1)}×`, peerHigh: `${(mid / last.equity * 1.5).toFixed(1)}×`, implied: fmtM(mid) },
      ],
      bridge: [
        { label: "Enterprise value", value: ev, kind: "start" },
        { label: "Less: interest-bearing debt", value: -lastDebt, kind: "less" },
        { label: "Add: cash and equivalents", value: lastCash, kind: "add" },
        { label: "Equity value before discounts", value: equityBefore, kind: "total" },
        { label: "Discounts and premium applied", value: mid - equityBefore, kind: "less" },
        { label: "Equity value · midpoint", value: mid, kind: "total" },
      ],
      notes: [
        "Normalised EBITDA is used throughout; reported EBITDA is restated for owner pay, related-party rent and one-off costs.",
        "The listed peer set is matched on sector and business model, then screened for size and profitability.",
        "The asking price remains the seller's. This range is an independent estimate by PitchSnack analysts.",
      ],
    },
  };

}
