import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Landmark,
  Lightbulb,
  PieChart as PieIcon,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPTY, fmtAmount, fmtNumber, fmtPercent, pctChange } from "@/lib/financials";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";

function pick(items: StatementItem[], code: string, year: number | undefined) {
  if (year === undefined) return null;
  const it = items.find((i) => i.item_code === code && i.fiscal_year === year);
  return it?.amount ?? null;
}

function ratio(ratios: RatioItem[], code: string, year: number | undefined) {
  if (year === undefined) return null;
  return ratios.find((r) => r.ratio_code === code && r.fiscal_year === year)?.value ?? null;
}

function ChangeChip({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">{EMPTY}</span>;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      )}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {fmtNumber(value)}%
    </span>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  currency,
  change,
  compareLabel,
}: {
  icon: typeof Coins;
  tone: string;
  label: string;
  value: number | null;
  currency: string;
  change: number | null;
  compareLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{fmtAmount(value)}</p>
          <p className="text-[11px] text-muted-foreground">{currency}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <ChangeChip value={change} />
        <span className="text-[11px] text-muted-foreground">{compareLabel}</span>
      </div>
    </div>
  );
}

function RatioCard({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">
        {value === null ? EMPTY : unit === "percent" ? fmtPercent(value) : `${fmtNumber(value)}x`}
      </p>
    </div>
  );
}

export function FinancialsOverview({
  years,
  currency,
  income,
  position,
  ratios,
}: {
  years: number[];
  currency: string;
  income: StatementItem[];
  position: StatementItem[];
  ratios: RatioItem[];
}) {
  const latest = years[years.length - 1];
  const prev = years.length > 1 ? years[years.length - 2] : undefined;

  const v = (code: string, year: number | undefined) => pick(income, code, year);
  const p = (code: string, year: number | undefined) => pick(position, code, year);

  const metrics = [
    { key: "total_revenue", label: "Total Revenue", get: v },
    { key: "gross_profit_loss", label: "Gross Profit (Loss)", get: v },
    { key: "net_profit_loss", label: "Net Profit (Loss)", get: v },
    { key: "total_assets", label: "Total Assets", get: p },
    { key: "total_liabilities", label: "Total Liabilities", get: p },
    { key: "equity", label: "Equity", get: p },
  ] as const;

  const kpis = [
    {
      label: "Total Revenue",
      icon: Coins,
      tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      value: v("total_revenue", latest),
      change: pctChange(v("total_revenue", latest), v("total_revenue", prev)),
    },
    {
      label: "Gross Profit",
      icon: TrendingUp,
      tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      value: v("gross_profit_loss", latest),
      change: pctChange(v("gross_profit_loss", latest), v("gross_profit_loss", prev)),
    },
    {
      label: "Net Profit (Loss)",
      icon: TrendingDown,
      tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      value: v("net_profit_loss", latest),
      change: pctChange(v("net_profit_loss", latest), v("net_profit_loss", prev)),
    },
    {
      label: "Total Assets",
      icon: PieIcon,
      tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
      value: p("total_assets", latest),
      change: pctChange(p("total_assets", latest), p("total_assets", prev)),
    },
    {
      label: "Equity",
      icon: Wallet,
      tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
      value: p("equity", latest),
      change: pctChange(p("equity", latest), p("equity", prev)),
    },
    {
      label: "Debt to Equity Ratio",
      icon: Scale,
      tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      value: ratio(ratios, "debt_to_equity_ratio", latest),
      change: pctChange(
        ratio(ratios, "debt_to_equity_ratio", latest),
        ratio(ratios, "debt_to_equity_ratio", prev),
      ),
    },
  ];

  const chartData = [
    { name: "Revenue from\nSales & Services", code: "revenue_sales_services" },
    { name: "Gross Profit\n(Loss)", code: "gross_profit_loss" },
    { name: "Net Profit\n(Loss)", code: "net_profit_loss" },
  ].map((row) => ({
    name: row.name.replace("\n", " "),
    previous: prev !== undefined ? (v(row.code, prev) ?? 0) : 0,
    latest: v(row.code, latest) ?? 0,
  }));

  const currentAssets = p("total_current_assets", latest);
  const nonCurrentAssets = p("total_non_current_assets", latest);
  const totalAssets = p("total_assets", latest);
  const totalLiabilities = p("total_liabilities", latest);
  const equity = p("equity", latest);

  const donut = [
    { name: "Current Assets", value: currentAssets ?? 0, fill: "hsl(221 83% 45%)" },
    { name: "Non-current Assets", value: nonCurrentAssets ?? 0, fill: "hsl(210 90% 70%)" },
  ];

  const ratioCards = [
    { code: "gross_profit_margin", label: "Gross Profit Margin" },
    { code: "return_on_assets", label: "Return on Assets" },
    { code: "return_on_equity", label: "Return on Equity" },
    { code: "current_ratio", label: "Current Ratio" },
    { code: "accounts_receivable_turnover", label: "Accounts Receivable Turnover" },
    { code: "inventory_turnover", label: "Inventory Turnover" },
    { code: "accounts_payable_turnover", label: "Accounts Payable Turnover" },
    { code: "total_assets_turnover", label: "Total Assets Turnover" },
    { code: "debt_to_asset_ratio", label: "Debt to Asset Ratio" },
    { code: "debt_to_equity_ratio", label: "Debt to Equity Ratio" },
    { code: "debt_to_capital_ratio", label: "Debt to Capital Ratio" },
  ].map((r) => {
    const row = ratios.find((x) => x.ratio_code === r.code && x.fiscal_year === latest);
    return { ...r, value: row?.value ?? null, unit: row?.unit ?? "times" };
  });

  const insights: string[] = [];
  const revChange = pctChange(v("total_revenue", latest), v("total_revenue", prev));
  if (revChange !== null)
    insights.push(
      `Total revenue ${revChange >= 0 ? "increased" : "decreased"} by ${fmtNumber(Math.abs(revChange))}% versus ${prev}.`,
    );
  const gmLatest = ratio(ratios, "gross_profit_margin", latest);
  const gmPrev = ratio(ratios, "gross_profit_margin", prev);
  if (gmLatest !== null && gmPrev !== null)
    insights.push(`Gross margin moved from ${fmtNumber(gmPrev)}% in ${prev} to ${fmtNumber(gmLatest)}% in ${latest}.`);
  const assetChange = pctChange(p("total_assets", latest), p("total_assets", prev));
  if (assetChange !== null)
    insights.push(
      `Total assets ${assetChange >= 0 ? "increased" : "decreased"} by ${fmtNumber(Math.abs(assetChange))}%.`,
    );
  const liabChange = pctChange(p("total_liabilities", latest), p("total_liabilities", prev));
  if (liabChange !== null)
    insights.push(
      `Total liabilities ${liabChange >= 0 ? "increased" : "decreased"} by ${fmtNumber(Math.abs(liabChange))}%.`,
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            icon={k.icon}
            tone={k.tone}
            label={k.label}
            value={k.value}
            currency={currency}
            change={k.change}
            compareLabel={prev !== undefined ? `vs ${prev}` : "no prior year"}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* A) Income highlights */}
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold">
            A) Income Highlights {prev !== undefined ? `(${prev} vs ${latest})` : `(${latest ?? EMPTY})`}
          </h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} width={64} />
                <Tooltip formatter={(val: number) => fmtAmount(val)} />
                <Bar dataKey="previous" name={String(prev ?? "")} fill="hsl(214 60% 80%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="latest" name={String(latest ?? "")} fill="hsl(222 47% 30%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* B) Financial position */}
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold">
            B) Financial Position {latest !== undefined ? `(as of ${latest})` : ""}
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={1}>
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => fmtAmount(val)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
              {[
                { label: "Current Assets", value: currentAssets },
                { label: "Non-current Assets", value: nonCurrentAssets },
                { label: "Total Liabilities", value: totalLiabilities },
                { label: "Equity", value: equity },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums font-medium">{fmtAmount(row.value)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Total Assets = Total Liabilities &amp; Equity</span>
            <span className="ml-auto tabular-nums font-semibold">
              {fmtAmount(totalAssets)} {currency}
            </span>
          </div>
        </section>

        {/* C) Key ratio snapshot */}
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold">
            C) Key Ratio Snapshot {latest !== undefined ? `(${latest})` : ""}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ratioCards.map((r) => (
              <RatioCard key={r.code} label={r.label} value={r.value} unit={r.unit} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold">Key Financial Summary ({currency})</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(222_47%_23%)] text-white">
                  <th className="px-3 py-2 text-left font-medium">Metric</th>
                  <th className="px-3 py-2 text-right font-medium">{prev ?? EMPTY}</th>
                  <th className="px-3 py-2 text-right font-medium">{latest ?? EMPTY}</th>
                  <th className="px-3 py-2 text-right font-medium">% Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const a = m.get(m.key, prev);
                  const b = m.get(m.key, latest);
                  return (
                    <tr key={m.key} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtAmount(a)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtAmount(b)}</td>
                      <td className="px-3 py-2 text-right">
                        <ChangeChip value={pctChange(b, a)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Insights
          </h3>
          {insights.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {insights.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough comparable years to derive observations.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
