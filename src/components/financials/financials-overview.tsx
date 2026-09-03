import { FinIcon } from "@/components/financials/fin-icon";
import { EMPTY, fmtAmount, fmtCompact, fmtNumber, pctChange } from "@/lib/financials";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";

/* Palette from the Financial Overview design spec. */
const C = {
  navy: "#122B54",
  ink: "#0F1B33",
  body: "#374151",
  muted: "#6B7280",
  line: "#E5E7EB",
  hair: "#EFF1F4",
  blue: "#2563EB",
  blueDark: "#1D4ED8",
  blueLight: "#93C5FD",
  blueBg: "#EAF1FD",
  barPrev: "#C7D6F0",
  green: "#16A34A",
  greenBg: "#E8F6EE",
  red: "#DC2626",
  redBg: "#FDECEC",
  purple: "#7C3AED",
  purpleBg: "#F1EBFE",
  amber: "#EA8A0B",
  amberBg: "#FEF2E2",
  teal: "#0E9BB5",
  tealBg: "#E4F5F9",
};

function pick(items: StatementItem[], code: string, year: number | undefined) {
  if (year === undefined) return null;
  return items.find((i) => i.item_code === code && i.fiscal_year === year)?.amount ?? null;
}

function ratioOf(ratios: RatioItem[], code: string, year: number | undefined) {
  if (year === undefined) return null;
  return ratios.find((r) => r.ratio_code === code && r.fiscal_year === year)?.value ?? null;
}

function ChangeText({ value, arrows = true }: { value: number | null; arrows?: boolean }) {
  if (value === null) return <span style={{ color: C.muted }}>{EMPTY}</span>;
  const up = value >= 0;
  return (
    <span style={{ color: up ? C.green : C.red, fontWeight: 700 }}>
      {arrows ? (up ? "▲ " : "▼ ") : up ? "+" : ""}
      {fmtNumber(value)}%
    </span>
  );
}

/** 62×30 sparkline with an arrow head on the final point. */
function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const pts = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = pts.length > 1 ? 56 / (pts.length - 1) : 0;
  const coords = pts.map((v, i) => [2 + i * step, 26 - ((v - min) / span) * 22] as const);
  const last = coords[coords.length - 1];
  return (
    <svg
      className="pointer-events-none absolute bottom-1.5 right-2 z-0 h-[30px] w-[62px]"
      viewBox="0 0 62 30"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${(last[0] - 6).toFixed(1)},${(last[1] - 1).toFixed(1)} ${last[0].toFixed(1)},${last[1].toFixed(1)} ${(last[0] - 1).toFixed(1)},${(last[1] + 7).toFixed(1)}`}
      />
    </svg>
  );
}

function KpiCard({
  icon,
  color,
  label,
  display,
  title,
  currency,
  change,
  compareLabel,
  series,
}: {
  icon: string;
  color: string;
  label: string;
  display: string;
  title: string;
  currency?: string;
  change: number | null;
  compareLabel: string;
  series: (number | null)[];
}) {
  return (
    <div
      className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-white p-[13px_14px]"
      style={{ border: `1px solid ${C.line}` }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: color }}
        >
          <FinIcon name={icon} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold leading-tight" style={{ color: C.ink }}>
            {label}
          </div>
          <div
            className="mt-[3px] whitespace-nowrap text-[18px] font-bold tabular-nums"
            style={{ color: C.ink }}
            title={title}
          >
            {display}
          </div>
          {currency ? (
            <div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>
              {currency}
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative z-[1] mt-auto flex items-center gap-1.5 text-[11.5px]">
        <ChangeText value={change} />
        <span style={{ color: C.muted }}>{compareLabel}</span>
      </div>
      <Sparkline values={series} color={color} />
    </div>
  );
}

function niceAxis(max: number) {
  if (max <= 0) return { top: 1, ticks: [1, 0.667, 0.333, 0] };
  const rough = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const top = step * 3;
  return { top, ticks: [top, step * 2, step, 0] };
}

export function FinancialsOverview({
  years,
  currency,
  income,
  position,
  ratios,
  year,
}: {
  years: number[];
  currency: string;
  income: StatementItem[];
  position: StatementItem[];
  ratios: RatioItem[];
  year?: number;
}) {
  const sorted = [...years].sort((a, b) => a - b);
  const latest = year !== undefined && sorted.includes(year) ? year : sorted[sorted.length - 1];
  const idx = sorted.indexOf(latest);
  const prev = idx > 0 ? sorted[idx - 1] : undefined;
  const upTo = sorted.slice(0, idx + 1);

  const v = (code: string, y: number | undefined) => pick(income, code, y);
  const p = (code: string, y: number | undefined) => pick(position, code, y);
  const r = (code: string, y: number | undefined) => ratioOf(ratios, code, y);

  const kpis = [
    {
      label: "Total Revenue",
      icon: "dollar",
      color: C.blueDark,
      value: v("total_revenue", latest),
      series: upTo.map((y) => v("total_revenue", y)),
      change: pctChange(v("total_revenue", latest), v("total_revenue", prev)),
      currency,
    },
    {
      label: "Gross Profit",
      icon: "trending-up",
      color: C.green,
      value: v("gross_profit_loss", latest),
      series: upTo.map((y) => v("gross_profit_loss", y)),
      change: pctChange(v("gross_profit_loss", latest), v("gross_profit_loss", prev)),
      currency,
    },
    {
      label: "Net Profit (Loss)",
      icon: "arrow-down",
      color: C.red,
      value: v("net_profit_loss", latest),
      series: upTo.map((y) => v("net_profit_loss", y)),
      change: pctChange(v("net_profit_loss", latest), v("net_profit_loss", prev)),
      currency,
    },
    {
      label: "Total Assets",
      icon: "pie",
      color: C.blue,
      value: p("total_assets", latest),
      series: upTo.map((y) => p("total_assets", y)),
      change: pctChange(p("total_assets", latest), p("total_assets", prev)),
      currency,
    },
    {
      label: "Equity",
      icon: "shield",
      color: C.purple,
      value: p("equity", latest),
      series: upTo.map((y) => p("equity", y)),
      change: pctChange(p("equity", latest), p("equity", prev)),
      currency,
    },
    {
      label: "Debt to Equity Ratio",
      icon: "scale",
      color: C.amber,
      value: r("debt_to_equity_ratio", latest),
      series: upTo.map((y) => r("debt_to_equity_ratio", y)),
      change: pctChange(r("debt_to_equity_ratio", latest), r("debt_to_equity_ratio", prev)),
      currency: undefined as string | undefined,
      ratio: true,
    },
  ];

  /* ── Row A: income highlights ── */
  const bars = [
    { code: "revenue_sales_services", lines: ["Revenue from", "Sales & Services"] },
    { code: "gross_profit_loss", lines: ["Gross Profit", "(Loss)"] },
    { code: "net_profit_loss", lines: ["Net Profit", "(Loss)"] },
  ].map((b) => ({
    ...b,
    prev: v(b.code, prev),
    curr: v(b.code, latest),
    change: pctChange(v(b.code, latest), v(b.code, prev)),
  }));

  const axisMax = Math.max(
    0,
    ...bars.flatMap((b) => [b.prev ?? 0, b.curr ?? 0].map((n) => (n > 0 ? n : 0))),
  );
  const axis = niceAxis(axisMax);
  const Y0 = 174;
  const YTOP = 30;
  const scale = (n: number | null) => (n === null || n <= 0 ? 0 : ((n / axis.top) * (Y0 - YTOP)));
  const groupCenters = [106, 238, 370];

  const miniRows = [
    { code: "revenue_sales_services", label: "Revenue from Sales & Services", icon: "dollar", color: C.blue },
    { code: "total_expenses", label: "Total Expenses", icon: "bar-chart", color: C.amber },
    { code: "net_profit_loss", label: "Net Profit (Loss)", icon: "arrow-down", color: C.red },
  ];

  /* ── Row B: financial position ── */
  const currentAssets = p("total_current_assets", latest);
  const nonCurrentAssets = p("total_non_current_assets", latest);
  const totalAssets = p("total_assets", latest);
  const totalLiabilities = p("total_liabilities", latest);
  const equity = p("equity", latest);
  const assetBase = (currentAssets ?? 0) + (nonCurrentAssets ?? 0);
  const circumference = 2 * Math.PI * 64;
  const currentShare = assetBase > 0 ? (currentAssets ?? 0) / assetBase : 0;
  const fundingBase = (totalLiabilities ?? 0) + (equity ?? 0);
  const share = (value: number | null, base: number) =>
    value === null || base <= 0 ? null : (value / base) * 100;

  /* ── Row C: 10 ratios (debt-to-equity lives in the KPI row) ── */
  const ratioTiles = [
    { code: "gross_profit_margin", label: "Gross Profit Margin", icon: "bar-chart", color: C.blue, bg: C.blueBg },
    { code: "return_on_assets", label: "Return on Assets", icon: "arrow-down-circle", color: C.green, bg: C.greenBg },
    { code: "return_on_equity", label: "Return on Equity", icon: "arrow-down-circle", color: C.purple, bg: C.purpleBg },
    { code: "current_ratio", label: "Current Ratio", icon: "droplet", color: C.teal, bg: C.tealBg },
    { code: "accounts_receivable_turnover", label: "Accounts Receivable Turnover", icon: "users", color: C.blue, bg: C.blueBg },
    { code: "inventory_turnover", label: "Inventory Turnover", icon: "box", color: C.amber, bg: C.amberBg },
    { code: "accounts_payable_turnover", label: "Accounts Payable Turnover", icon: "card", color: C.purple, bg: C.purpleBg },
    { code: "total_assets_turnover", label: "Total Assets Turnover", icon: "refresh", color: C.teal, bg: C.tealBg },
    { code: "debt_to_asset_ratio", label: "Debt to Asset Ratio", icon: "diamond", color: C.red, bg: C.redBg },
    { code: "debt_to_capital_ratio", label: "Debt to Capital Ratio", icon: "bank", color: C.navy, bg: C.blueBg },
  ].map((t) => {
    const row = ratios.find((x) => x.ratio_code === t.code && x.fiscal_year === latest);
    return { ...t, value: row?.value ?? null, unit: row?.unit ?? "times" };
  });

  /* ── Summary + insights ── */
  const summary = [
    { key: "total_revenue", label: "Total Revenue", get: v, icon: "dollar", color: C.blue },
    { key: "gross_profit_loss", label: "Gross Profit (Loss)", get: v, icon: "trending-up", color: C.green },
    { key: "total_assets", label: "Total Assets", get: p, icon: "pie", color: C.blue },
    { key: "total_liabilities", label: "Total Liabilities", get: p, icon: "shield", color: C.purple },
    { key: "equity", label: "Equity", get: p, icon: "shield", color: C.purple },
    { key: "net_profit_loss", label: "Net Profit (Loss)", get: v, icon: "arrow-down", color: C.red },
  ] as const;

  const insights: string[] = [];
  const revChange = pctChange(v("total_revenue", latest), v("total_revenue", prev));
  if (revChange !== null)
    insights.push(
      `Revenue ${revChange >= 0 ? "grew" : "fell"} ${fmtNumber(Math.abs(revChange))}% in ${latest}, from ${fmtCompact(v("total_revenue", prev))} to ${fmtCompact(v("total_revenue", latest))} ${currency}.`,
    );
  const gmL = r("gross_profit_margin", latest);
  const gmP = r("gross_profit_margin", prev);
  if (gmL !== null && gmP !== null)
    insights.push(`Gross margin moved from ${fmtNumber(gmP)}% in ${prev} to ${fmtNumber(gmL)}% in ${latest}.`);
  const npL = v("net_profit_loss", latest);
  const revL = v("total_revenue", latest);
  if (npL !== null && revL !== null && revL !== 0)
    insights.push(
      `Net profit is ${fmtCompact(npL)} ${currency}, ${fmtNumber((npL / revL) * 100)}% of revenue.`,
    );
  const deL = r("debt_to_equity_ratio", latest);
  const deP = r("debt_to_equity_ratio", prev);
  if (deL !== null && deP !== null)
    insights.push(`Debt-to-equity moved from ${fmtNumber(deP)}x in ${prev} to ${fmtNumber(deL)}x in ${latest}.`);
  const eqShare = share(equity, fundingBase);
  if (eqShare !== null)
    insights.push(`Equity funds ${fmtNumber(eqShare)}% of the balance sheet.`);

  const cardStyle = { border: `1px solid ${C.line}` };

  return (
    <div className="space-y-3 text-[13px]" style={{ color: C.body }}>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-[11px] md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            icon={k.icon}
            color={k.color}
            label={k.label}
            display={
              k.value === null
                ? EMPTY
                : "ratio" in k && k.ratio
                  ? `${fmtNumber(k.value)}x`
                  : fmtCompact(k.value)
            }
            title={k.value === null ? EMPTY : fmtAmount(k.value)}
            currency={k.currency}
            change={k.change}
            compareLabel={prev !== undefined ? `vs ${prev}` : "no prior year"}
            series={k.series}
          />
        ))}
      </div>

      {/* Row A / B / C */}
      <div className="grid items-stretch gap-[11px] grid-cols-1 xl:[grid-template-columns:1.06fr_0.94fr_1.20fr]">
        {/* A */}
        <section className="flex min-w-0 flex-col rounded-xl bg-white p-[15px_17px]" style={cardStyle}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
            A) Income Highlights{" "}
            <span className="font-medium" style={{ color: C.muted }}>
              ({prev ?? EMPTY} vs {latest ?? EMPTY})
            </span>
          </h2>
          <div className="mb-0.5 flex gap-3.5 text-[11px]" style={{ color: C.muted }}>
            <span>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-sm align-[-1px]" style={{ background: C.barPrev }} />
              {prev ?? EMPTY}
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-sm align-[-1px]" style={{ background: C.navy }} />
              {latest ?? EMPTY}
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2 w-2 rounded-full align-[-1px]" style={{ background: C.green }} />
              % Change
            </span>
          </div>
          <svg viewBox="0 0 460 214" width="100%" className="block">
            <g fontSize="9.5" fill={C.muted}>
              <text x="0" y="16">
                {currency}
              </text>
              {axis.ticks.map((t, i) => (
                <text key={t} x={i === 3 ? 14 : 0} y={YTOP + i * 48 + 4}>
                  {t === 0 ? "0" : fmtCompact(t, 1)}
                </text>
              ))}
            </g>
            <g stroke={C.hair}>
              {axis.ticks.map((t, i) => (
                <line key={t} x1="34" y1={YTOP + i * 48} x2="460" y2={YTOP + i * 48} />
              ))}
            </g>
            {bars.map((b, i) => {
              const cx = groupCenters[i];
              const hPrev = scale(b.prev);
              const hCurr = scale(b.curr);
              const topY = Math.min(Y0 - hPrev, Y0 - hCurr);
              return (
                <g key={b.code}>
                  <rect x={cx - 34} y={Y0 - hPrev} width="32" height={Math.max(hPrev, 1)} fill={C.barPrev} rx="2" />
                  <rect x={cx + 2} y={Y0 - hCurr} width="32" height={Math.max(hCurr, 1)} fill={C.navy} rx="2" />
                  <text x={cx - 18} y={Y0 - hPrev - 5} fontSize="9" fill={C.body} textAnchor="middle">
                    {b.prev === null ? EMPTY : fmtCompact(b.prev, 1)}
                  </text>
                  <text x={cx + 18} y={Y0 - hCurr - 5} fontSize="9" fill={C.ink} textAnchor="middle" fontWeight="700">
                    {b.curr === null ? EMPTY : fmtCompact(b.curr, 1)}
                  </text>
                  {b.change !== null && (
                    <>
                      <rect
                        x={cx - 26}
                        y={Math.max(6, topY - 32)}
                        width="52"
                        height="14"
                        rx="7"
                        fill={b.change >= 0 ? C.greenBg : C.redBg}
                      />
                      <text
                        x={cx}
                        y={Math.max(6, topY - 32) + 10}
                        fontSize="8.5"
                        fill={b.change >= 0 ? C.green : C.red}
                        textAnchor="middle"
                        fontWeight="700"
                      >
                        {b.change >= 0 ? "+" : ""}
                        {fmtNumber(b.change)}%
                      </text>
                    </>
                  )}
                  <g fontSize="9.5" fill={C.body} textAnchor="middle">
                    <text x={cx} y="194">
                      {b.lines[0]}
                    </text>
                    <text x={cx} y="206">
                      {b.lines[1]}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          <table className="mt-auto w-full border-collapse pt-1.5 text-[11.5px]">
            <thead>
              <tr>
                <th className="border-b py-1 pl-1 text-left text-[10.5px] font-semibold" style={{ borderColor: C.hair, color: C.muted }} />
                <th className="border-b px-1 py-1 text-right text-[10.5px] font-semibold" style={{ borderColor: C.hair, color: C.muted }}>
                  {prev ?? EMPTY}
                </th>
                <th className="border-b px-1 py-1 text-right text-[10.5px] font-semibold" style={{ borderColor: C.hair, color: C.muted }}>
                  {latest ?? EMPTY}
                </th>
                <th className="border-b px-1 py-1 text-right text-[10.5px] font-semibold" style={{ borderColor: C.hair, color: C.muted }}>
                  % Change
                </th>
              </tr>
            </thead>
            <tbody>
              {miniRows.map((row) => {
                const a = v(row.code, prev);
                const b = v(row.code, latest);
                return (
                  <tr key={row.code}>
                    <td className="border-b p-1 text-left font-medium" style={{ borderColor: C.hair, color: C.ink }}>
                      <span
                        className="mr-1.5 inline-flex h-[15px] w-[15px] items-center justify-center rounded-full align-[-3px] text-white"
                        style={{ background: row.color }}
                      >
                        <FinIcon name={row.icon} className="h-[9px] w-[9px]" />
                      </span>
                      {row.label}
                    </td>
                    <td className="whitespace-nowrap border-b p-1 text-right tabular-nums" style={{ borderColor: C.hair }}>
                      {fmtAmount(a)}
                    </td>
                    <td className="whitespace-nowrap border-b p-1 text-right tabular-nums" style={{ borderColor: C.hair }}>
                      {fmtAmount(b)}
                    </td>
                    <td className="whitespace-nowrap border-b p-1 text-right" style={{ borderColor: C.hair }}>
                      <ChangeText value={pctChange(b, a)} arrows={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* B */}
        <section className="flex min-w-0 flex-col rounded-xl bg-white p-[15px_17px]" style={cardStyle}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
            B) Financial Position{" "}
            <span className="font-medium" style={{ color: C.muted }}>
              (as of {latest ?? EMPTY})
            </span>
          </h2>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center gap-3.5">
              <svg viewBox="0 0 180 180" width="152" height="152" className="shrink-0">
                <circle cx="90" cy="90" r="64" fill="none" stroke={C.blueLight} strokeWidth="34" />
                {assetBase > 0 && (
                  <circle
                    cx="90"
                    cy="90"
                    r="64"
                    fill="none"
                    stroke={C.blueDark}
                    strokeWidth="34"
                    strokeDasharray={`${(circumference * currentShare).toFixed(1)} ${(circumference * (1 - currentShare)).toFixed(1)}`}
                    transform="rotate(-90 90 90)"
                  />
                )}
                <text x="90" y="84" textAnchor="middle" fontSize="10" fill={C.muted}>
                  Total Assets
                </text>
                <text x="90" y="102" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.ink}>
                  {fmtCompact(totalAssets)}
                </text>
                <text x="90" y="116" textAnchor="middle" fontSize="9.5" fill={C.muted}>
                  {currency}
                </text>
              </svg>
              <div className="min-w-0 flex-1 rounded-[10px] px-[11px] py-[9px]" style={{ border: `1px solid ${C.hair}` }}>
                {[
                  { label: "Current Assets", value: currentAssets, color: C.blueDark, base: assetBase },
                  { label: "Non-current Assets", value: nonCurrentAssets, color: C.blueLight, base: assetBase },
                  { sep: true as const },
                  { label: "Total Liabilities", value: totalLiabilities, color: C.purple, base: fundingBase },
                  { label: "Equity", value: equity, color: C.green, base: fundingBase },
                ].map((row, i) =>
                  "sep" in row ? (
                    <div key="sep" className="my-[5px]" style={{ borderTop: `1px solid ${C.hair}` }} />
                  ) : (
                    <div key={row.label ?? i} className="flex items-start justify-between gap-3 py-1.5">
                      <span className="whitespace-nowrap text-xs">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-[1px]"
                          style={{ background: row.color }}
                        />
                        {row.label}
                      </span>
                      <span className="whitespace-nowrap text-right">
                        <b className="text-[12.5px] font-bold tabular-nums" style={{ color: C.ink }}>
                          {fmtAmount(row.value ?? null)}
                        </b>
                        <small className="block text-[11px]" style={{ color: C.muted }}>
                          {share(row.value ?? null, row.base ?? 0) === null
                            ? EMPTY
                            : `(${fmtNumber(share(row.value ?? null, row.base ?? 0))}%)`}
                        </small>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div
              className="mt-[11px] flex items-center gap-3 rounded-[10px] px-[15px] py-[13px]"
              style={{ background: C.blueBg }}
            >
              <FinIcon name="scale" className="h-[26px] w-[26px]" style={{ color: C.navy }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: C.navy }}>
                  Total Assets &nbsp;=&nbsp; Total Liabilities &amp; Equity
                </div>
                <div className="mt-0.5 text-[14.5px] font-bold tabular-nums" style={{ color: C.navy }}>
                  {fmtAmount(totalAssets)} {currency}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* C */}
        <section className="flex min-w-0 flex-col rounded-xl bg-white p-[15px_17px]" style={cardStyle}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
            C) Key Ratio Snapshot{" "}
            <span className="font-medium" style={{ color: C.muted }}>
              ({latest ?? EMPTY})
            </span>
          </h2>
          <div className="grid flex-1 grid-cols-2 gap-[9px] [align-content:start] lg:grid-cols-3">
            {ratioTiles.map((t) => (
              <div
                key={t.code}
                className="flex items-center gap-2.5 rounded-[10px] px-[11px] py-2.5"
                style={{ border: `1px solid ${C.hair}` }}
              >
                <span
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: t.bg, color: t.color }}
                >
                  <FinIcon name={t.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] leading-tight" style={{ color: C.muted }}>
                    {t.label}
                  </div>
                  <div className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color: C.ink }}>
                    {t.value === null
                      ? EMPTY
                      : t.unit === "percent"
                        ? `${fmtNumber(t.value)}%`
                        : `${fmtNumber(t.value)}x`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid items-stretch gap-[11px] grid-cols-1 lg:[grid-template-columns:1.15fr_1fr]">
        <section className="flex min-w-0 flex-col rounded-xl bg-white p-[15px_17px]" style={cardStyle}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
            Key Financial Summary{" "}
            <span className="font-medium" style={{ color: C.muted }}>
              ({currency})
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr style={{ background: C.navy, color: "#fff" }}>
                  <th className="rounded-tl-lg px-2.5 py-2 text-center text-[11.5px] font-semibold">Metric</th>
                  <th className="px-2.5 py-2 text-right text-[11.5px] font-semibold">{prev ?? EMPTY}</th>
                  <th className="px-2.5 py-2 text-right text-[11.5px] font-semibold">{latest ?? EMPTY}</th>
                  <th className="rounded-tr-lg px-2.5 py-2 text-right text-[11.5px] font-semibold">
                    <span
                      className="inline-flex items-center gap-1"
                      title={`% Change = (${latest ?? "current year"} − ${prev ?? "prior year"}) ÷ |${prev ?? "prior year"}| × 100`}
                    >
                      % Change
                      <FinIcon name="info" className="h-3 w-3" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.map((m, i) => {
                  const a = m.get(m.key, prev);
                  const b = m.get(m.key, latest);
                  return (
                    <tr key={m.key} style={{ background: i % 2 === 1 ? "#FAFBFD" : undefined }}>
                      <td className="border-b px-2.5 py-[7px] text-left font-medium" style={{ borderColor: C.hair, color: C.ink }}>
                        <span
                          className="mr-1.5 inline-flex h-[15px] w-[15px] items-center justify-center rounded-full align-[-3px] text-white"
                          style={{ background: m.color }}
                        >
                          <FinIcon name={m.icon} className="h-[9px] w-[9px]" />
                        </span>
                        {m.label}
                      </td>
                      <td className="whitespace-nowrap border-b px-2.5 py-[7px] text-right tabular-nums" style={{ borderColor: C.hair }}>
                        {fmtAmount(a)}
                      </td>
                      <td className="whitespace-nowrap border-b px-2.5 py-[7px] text-right tabular-nums" style={{ borderColor: C.hair }}>
                        {fmtAmount(b)}
                      </td>
                      <td className="whitespace-nowrap border-b px-2.5 py-[7px] text-right" style={{ borderColor: C.hair }}>
                        <ChangeText value={pctChange(b, a)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-white p-[15px_17px]" style={cardStyle}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
            <FinIcon name="bulb" style={{ color: C.amber }} /> Insights
          </h2>
          {insights.length ? (
            <ul className="relative z-[1] list-disc pl-5">
              {insights.map((i) => (
                <li key={i} className="my-2 text-[12.5px]">
                  {i}
                </li>
              ))}
            </ul>
          ) : (
            <p className="relative z-[1] text-[12.5px]" style={{ color: C.muted }}>
              Not enough comparable years to derive observations.
            </p>
          )}
          <img
            src="/img/insights-illustration.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-3.5 -right-1.5 w-[190px] opacity-95"
          />
        </section>
      </div>
    </div>
  );
}
