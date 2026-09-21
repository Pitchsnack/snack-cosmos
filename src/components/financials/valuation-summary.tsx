/**
 * Valuation → Summary. The answer first, the working beneath it.
 * All bars and the axis are CSS; no charting library.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { benchmarkMedians, type Peer } from "@/lib/peer-comparables";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";
import {
  BAND_PCT,
  fmtMoney,
  fmtMult,
  fmtPct,
  ladderFactors,
  scalePos,
  type Discounts,
  type FilingInputs,
  type ValuationResult,
} from "@/lib/valuation";

const ACC = "#1E3A8A";

/* ------------------------------------------------------------------ */
/* Block framing                                                       */
/* ------------------------------------------------------------------ */

function Block({
  label,
  hint,
  right,
  children,
}: {
  label: string;
  hint: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[13px] overflow-hidden rounded-[8px] border border-[#EAECEF]">
      <div className="flex items-baseline gap-[9px] bg-[#1E3A8A] px-3 py-2">
        <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-white">
          {label}
        </h3>
        <span className="text-[11px] font-normal text-[#B9C6E4]">{hint}</span>
        {right && <span className="ml-auto text-[11px] text-[#B9C6E4]">{right}</span>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assumption value — editable                                         */
/* ------------------------------------------------------------------ */

function AdjInput({
  value,
  onChange,
  sign,
  off,
}: {
  value: number;
  onChange: (v: number) => void;
  sign: "minus" | "plus";
  off?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 border-b border-dashed border-[#C3CBDA] px-1 py-[1px] font-semibold ${
        off ? "font-normal text-muted-foreground" : "text-[#1E3A8A]"
      }`}
    >
      {sign === "minus" ? "−" : "+"}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[42px] bg-transparent text-right tabular-nums outline-none"
        aria-label="adjustment percent"
      />
      %
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export function ValuationSummary({
  startupName,
  year,
  result,
  discounts,
  setDiscounts,
  peers,
  refreshText,
  ratios,
  income,
  inputs,
  onMethods,
  renderMatching,
}: {
  startupName: string;
  year: number | undefined;
  result: ValuationResult;
  discounts: Discounts;
  setDiscounts: (d: Discounts) => void;
  peers: Peer[];
  refreshText: string | null;
  ratios: RatioItem[];
  income: StatementItem[];
  inputs: FilingInputs;
  onMethods: () => void;
  /** The one matching row; receives the peers toggle for its right edge. */
  renderMatching: (toggle: React.ReactNode) => React.ReactNode;
}) {
  const [showPeers, setShowPeers] = useState(true);
  const { indicative, spread } = result;

  // Mixed fiscal year-ends are normal in Thailand — worth stating, not warning about.
  const periodNote = (() => {
    const counts = new Map<string, number>();
    for (const p of peers) {
      const key = p.statementPeriod?.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size < 2) return null;
    const parts = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([period, n]) => `${n} peer${n === 1 ? "" : "s"} ${period}`);
    return `Periods differ: ${parts.join(", ")}.`;
  })();



  const ratio = (code: string) =>
    ratios.find((r) => r.ratio_code === code && r.fiscal_year === year)?.value ?? null;
  const revenueGrowth =
    income.find((i) => i.item_code === "revenue_sales_services" && i.fiscal_year === year)
      ?.percent_change ?? null;

  const f = ladderFactors(discounts);
  const m = result.medians;
  const step = (cumulative: number, base: number | null) =>
    base === null ? null : base * cumulative;

  const ladder: { step: string; adj: React.ReactNode; pbv: number | null; evs: number | null }[] = [
    {
      step: "Peer median",
      adj: <span className="text-muted-foreground">—</span>,
      pbv: m.pbv,
      evs: m.evSales,
    },
    {
      step: "Marketability",
      adj: (
        <AdjInput
          sign="minus"
          value={discounts.marketability}
          onChange={(v) => setDiscounts({ ...discounts, marketability: v })}
        />
      ),
      pbv: step(f.marketability, m.pbv),
      evs: step(f.marketability, m.evSales),
    },
    {
      step: "Size",
      adj: (
        <AdjInput
          sign="minus"
          value={discounts.size}
          onChange={(v) => setDiscounts({ ...discounts, size: v })}
        />
      ),
      pbv: step(f.marketability * f.size, m.pbv),
      evs: step(f.marketability * f.size, m.evSales),
    },
    {
      step: "Growth differential",
      adj: (
        <AdjInput
          sign="plus"
          value={discounts.growth}
          onChange={(v) => setDiscounts({ ...discounts, growth: v })}
        />
      ),
      pbv: step(f.marketability * f.size * f.growth, m.pbv),
      evs: step(f.marketability * f.size * f.growth, m.evSales),
    },
    {
      step: "Control premium",
      adj:
        discounts.control === null ? (
          <button
            type="button"
            onClick={() => setDiscounts({ ...discounts, control: 20 })}
            className="border-b border-dashed border-[#C3CBDA] px-1 py-[1px] text-muted-foreground"
          >
            not applied
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <AdjInput
              sign="plus"
              value={discounts.control}
              onChange={(v) => setDiscounts({ ...discounts, control: v })}
            />
            <button
              type="button"
              onClick={() => setDiscounts({ ...discounts, control: null })}
              className="text-[11px] text-muted-foreground underline"
            >
              remove
            </button>
          </span>
        ),
      pbv: step(f.total, m.pbv),
      evs: step(f.total, m.evSales),
    },
  ];

  return (
    <div>
      {/* 1 · Headline */}
      <div className="mb-[13px] rounded-[8px] border border-[#DDE3F2] bg-[#F5F7FD] px-3.5 pb-3 pt-3.5">
        <div className="text-[23px] font-normal leading-[1.22] tracking-[-0.01em] text-[#0F1B33]">
          {indicative ? (
            <>
              Between <b className="font-semibold text-[#1E3A8A]">{fmtMoney(indicative.low)}</b> and{" "}
              <b className="font-semibold text-[#1E3A8A]">{fmtMoney(indicative.high)} THB</b>
            </>
          ) : spread ? (
            <>
              Methods do not agree — they span{" "}
              <b className="font-semibold text-[#1E3A8A]">{fmtMoney(spread.low)}</b> to{" "}
              <b className="font-semibold text-[#1E3A8A]">{fmtMoney(spread.high)} THB</b>
            </>
          ) : (
            "No indicative range"
          )}
        </div>
        <div className="mt-[3px] text-[12px] text-muted-foreground">
          {indicative
            ? result.singleMethod
              ? `${result.agreeNames[0]} only — single method`
              : `Where ${listNames(result.agreeNames)} agree`
            : spread
              ? "The remaining methods do not overlap, so no single range can be quoted"
              : "No method could be computed"}
          {result.tails.map((t) => (
            <span key={t.key} className="text-[#B45309]">
              {" · "}
              {t.name.toLowerCase()} excluded as a tail (
              {t.ratio === null ? "—" : `${t.ratio.toFixed(1)}×`} the median)
            </span>
          ))}
          {result.included
            .filter((m) => m.status === "low confidence")
            .map((m) => (
              <span key={m.key}>{` · ${m.name} is low confidence`}</span>
            ))}
          {year ? ` · filing FY${year}` : ""}
        </div>
        {spread && (
          <Axis
            spread={spread}
            indicative={indicative}
            book={result.bookValue}
            tails={result.tails.map((t) => {
              const row = result.drawn.find((d) => d.key === t.key)!;
              return { name: t.name, low: row.low!, high: row.high! };
            })}
          />
        )}
        <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span>
            <i
              className="mr-[7px] inline-block h-[5px] w-4 rounded-[3px] align-[1px]"
              style={{ background: "linear-gradient(90deg,#2D4B9E,#16296A)" }}
            />
            agreed range
          </span>
          <span>
            <i
              className="mr-[7px] inline-block h-[5px] w-4 rounded-[3px] align-[1px]"
              style={{ background: "linear-gradient(90deg,#D8E6F6,#A8BFE2)" }}
            />
            span of included methods
          </span>
          {result.bookValue !== null && (
            <span>
              <i className="mr-[7px] inline-block h-[10px] w-0 border-l-[1.5px] border-dashed border-[#8A93A0] align-[-1px]" />
              book value — reference only
            </span>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          The axis fits the included methods. A tail is named at the edge rather than stretching the
          scale.
        </p>
      </div>


      {/* 2 · Notice */}
      {result.blocked && (
        <div className="mb-3.5 flex items-baseline gap-[9px] rounded-[7px] border border-[#F2E3CE] bg-[#FDF7EF] px-[11px] py-2 text-[12px] text-[#B45309]">
          <span>
            {result.blocked.name} unavailable — {result.blocked.reason.replace(/^Unavailable — /, "")}
          </span>
          <button type="button" onClick={onMethods} className="ml-auto whitespace-nowrap text-[#9A6B2E]">
            Methods →
          </button>
        </div>
      )}

      {/* 3 · Benchmark */}
      <Block label="Benchmark" hint="against the peer median" right="no assumptions applied">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Metric", startupName, "Peer median", "", "Gap"].map((h, i) => (
                <th
                  key={i}
                  className={`border-b border-[#F2F4F6] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${
                    i === 0 ? "text-left text-muted-foreground" : "text-right"
                  } ${i === 1 ? "text-[#0F1B33]" : i === 0 ? "" : "text-muted-foreground"} ${
                    i === 3 ? "w-[56px]" : i === 4 ? "w-[88px]" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <BenchRow
              label="Gross margin"
              own={ratio("gross_profit_margin") ?? inputs.grossMarginPct}
              peer={bench.grossMarginPct.value}
              peerCount={bench.grossMarginPct.count}
            />
            <BenchRow
              label="EBITDA margin"
              own={null}
              ownRange={
                inputs.ebitdaMarginLowPct !== null && inputs.ebitdaMarginHighPct !== null
                  ? { low: inputs.ebitdaMarginLowPct, high: inputs.ebitdaMarginHighPct }
                  : null
              }
              estimated={inputs.ebitdaEstimated}
              sub={
                inputs.ebitMarginPct !== null
                  ? `floor ${fmtPct(inputs.ebitMarginPct, 1)} (EBIT margin)`
                  : null
              }
              tooltip="Estimated. The cash flow statement is empty, so D&A is bracketed from the balance sheet: equipment depreciated over 3–5 years, with other non-current assets amortised over 5 years at most. EBIT is exact."
              blocked={inputs.ebitdaLow === null}
              blockedNote="needs D&A"
              peer={result.medians.ebitdaMarginPct}
              peerCount={peers.filter((p) => typeof p.ebitdaMarginPct === "number").length}
            />

            <BenchRow
              label="Net margin"
              own={ratio("net_profit_margin") ?? inputs.netMarginPct}
              peer={bench.netMarginPct.value}
              peerCount={bench.netMarginPct.count}
            />
            <BenchRow
              label="Return on equity"
              own={ratio("return_on_equity")}
              peer={bench.roePct.value}
              peerCount={bench.roePct.count}
            />
            <BenchRow
              label="Debt to equity"
              own={ratio("debt_to_equity_ratio")}
              peer={bench.debtEquity.value}
              peerCount={bench.debtEquity.count}
              unit="×"
              lowerIsBetter
            />
            <BenchRow
              label="Revenue growth"
              own={revenueGrowth}
              peer={bench.revenueGrowthPct.value}
              peerCount={bench.revenueGrowthPct.count}
            />
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A peer median shows only where the peer set carries that metric. Blank means the
          reference is not held, not that the company was not measured.
        </p>
      </Block>

      {/* 4 · Compared against */}
      <Block
        label="Compared against"
        hint="the peer set behind every figure above"
        right={
          <Link to="/peer-comparables" search={{}} className="font-semibold text-white">
            Peer set →
          </Link>
        }
      >
        {renderMatching(
          <button
            type="button"
            onClick={() => setShowPeers((v) => !v)}
            className="text-[12px] font-medium text-[#1E3A8A]"
          >
            {showPeers ? "Hide peers ▴" : "Show peers ▾"}
          </button>,
        )}


        {showPeers && (
          <div className="mt-[9px] overflow-hidden rounded-[6px] border border-[#EAECEF]">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {[
                    "Company",
                    "Period",
                    "Revenue THB m",
                    "EBITDA margin",
                    "EV/EBITDA",
                    "P/E",
                    "P/BV",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`border-b border-[#EAECEF] bg-[#FAFBFC] px-2.5 py-[7px] text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                        i === 0 ? "text-left" : i === 1 ? "text-left" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.id ?? p.companyName}>
                    <td className="border-b border-[#F2F4F6] px-2.5 py-[7px] font-medium text-[#0F1B33]">
                      {p.ticker ?? p.companyName}
                      <span
                        className={`ml-1.5 rounded-[3px] px-[5px] py-[1px] text-[9.5px] font-bold ${
                          p.market === "mai"
                            ? "bg-[#EAF7EE] text-[#15803D]"
                            : "bg-[#EEF2FB] text-[#1E3A8A]"
                        }`}
                      >
                        {p.market}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-b border-[#F2F4F6] px-2.5 py-[7px] text-muted-foreground">
                      {p.statementPeriod ?? "—"}
                    </td>
                    <Num v={p.revenueThbM} />
                    <Num v={p.ebitdaMarginPct} suffix="%" />
                    <Num v={p.evEbitda} suffix="×" />
                    <Num v={p.pe} suffix="×" />
                    <Num v={p.pbv} suffix="×" />
                  </tr>
                ))}
                {peers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-4 text-center text-muted-foreground">
                      This peer set holds no companies yet.
                    </td>
                  </tr>
                )}
                {peers.length > 0 && (
                  <tr className="bg-[#F5F7FD] font-semibold text-[#1E3A8A]">
                    <td className="border-t border-[#DDE3F2] px-2.5 py-[7px]">
                      Median · {peers.length} peer{peers.length === 1 ? "" : "s"}
                    </td>
                    <td className="border-t border-[#DDE3F2] px-2.5 py-[7px]" />
                    <Num v={result.medians.revenueThbM} median />
                    <Num v={result.medians.ebitdaMarginPct} suffix="%" median />
                    <Num v={result.medians.evEbitda} suffix="×" median />
                    <Num v={result.medians.pe} suffix="×" median />
                    <Num v={result.medians.pbv} suffix="×" median />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {periodNote && (
          <div className="mt-2 text-[11.5px] text-muted-foreground">{periodNote}</div>
        )}
        {peers.length > 0 && peers.length < 5 && (
          <div className="mt-2 border-t border-[#F2F4F6] pt-2 text-[11.5px] text-[#B45309]">
            <b>
              {peers.length} peer{peers.length === 1 ? "" : "s"}
            </b>{" "}
            — a median this thin is easily moved by one company.
          </div>
        )}

      </Block>

      {/* 5 · By method */}
      <Block label="By method" hint="each range, on one scale">
        {result.drawn.length === 0 || !spread ? (
          <p className="text-[12px] text-muted-foreground">
            No method could be computed from this filing and peer set.
          </p>
        ) : (
          <>
            {result.drawn.map((row) => (
              <MethodRow
                key={row.key}
                row={row}
                domain={chartDomain(spread, result.bookValue)}
                zone={result.zone}
                reference={result.reference}
                tail={result.tails.find((t) => t.key === row.key) ?? null}
                showMedianCap={row.key === result.candidates[0]?.key}
              />
            ))}
            {indicative && (
              <div className="-mx-3 -mb-3 mt-1 grid grid-cols-[132px_1fr_128px] items-center gap-3.5 rounded-b-[7px] border-t border-[#DDE3F2] bg-[#F5F7FD] px-3 py-2.5">
                <div className="text-[12.5px] font-semibold text-[#1E3A8A]">
                  Indicative valuation
                  <small className="block text-[11px] font-normal text-muted-foreground">
                    {result.agreeNames.join(" ∩ ")}
                  </small>
                </div>
                <div className="relative h-1.5 rounded-[3px] bg-[#E3E8F4]">
                  {(() => {
                    const d = chartDomain(spread, result.bookValue);
                    const l = scalePos(indicative.low, d.low, d.high);
                    return (
                      <div
                        className="absolute top-0 h-1.5 rounded-[3px]"
                        style={{
                          left: `${l}%`,
                          width: `${Math.max(2, scalePos(indicative.high, d.low, d.high) - l)}%`,
                          background: "linear-gradient(90deg,#2D4B9E 0%,#1E3A8A 50%,#16296A 100%)",
                        }}
                      />
                    );
                  })()}
                </div>
                <div className="text-right text-[12.5px] font-semibold tabular-nums text-[#1E3A8A]">
                  {fmtMoney(indicative.low)} – {fmtMoney(indicative.high)}
                </div>
              </div>
            )}

            {/* How the range was chosen */}
            {result.candidates.length > 0 && (
              <div className="mt-2.5 border-t border-[#F2F4F6] pt-2.5">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      {[
                        "Method",
                        "Midpoint",
                        result.reference === null
                          ? "vs median"
                          : `vs median ${fmtMoney(result.reference)}`,
                        "Result",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`border-b border-[#F2F4F6] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                            i === 0 ? "text-left" : "text-right"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((c) => (
                      <tr key={c.key}>
                        <td className="border-b border-[#F2F4F6] py-[5px] text-[#0F1B33]">
                          {c.name}
                        </td>
                        <td className="border-b border-[#F2F4F6] py-[5px] text-right tabular-nums text-[#0F1B33]">
                          {fmtMoney(c.midpoint)}
                        </td>
                        <td className="border-b border-[#F2F4F6] py-[5px] text-right tabular-nums text-[#0F1B33]">
                          {c.ratio === null ? "—" : `${c.ratio.toFixed(1)}×`}
                        </td>
                        <td
                          className={`border-b border-[#F2F4F6] py-[5px] text-right font-semibold ${
                            c.tail ? "text-[#B45309]" : "text-[#15803D]"
                          }`}
                        >
                          {c.tail
                            ? "tail — excluded"
                            : c.lowConfidence
                              ? "in · low confidence"
                              : "in"}
                        </td>
                      </tr>
                    ))}
                    {result.bookValue !== null && (
                      <tr className="text-muted-foreground">
                        <td className="py-[5px]">Book value</td>
                        <td className="py-[5px] text-right tabular-nums">
                          {fmtMoney(result.bookValue)}
                        </td>
                        <td className="py-[5px] text-right">—</td>
                        <td className="py-[5px] text-right">reference, not a candidate</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="mt-[7px] text-[11.5px] text-muted-foreground">
                  A method is a <b className="text-[#0F1B33]">tail</b> when its midpoint is below{" "}
                  <b className="text-[#0F1B33]">0.5×</b> or above{" "}
                  <b className="text-[#0F1B33]">2×</b> the median of all midpoints
                  {result.zone
                    ? ` — here, outside ${fmtMoney(result.zone.low)} – ${fmtMoney(result.zone.high)}, the faint band on the chart`
                    : ""}
                  . The rule runs only with 3 or more methods
                  {result.ruleRan ? "" : ", so it did not run here"}.
                </div>
              </div>
            )}
          </>
        )}
      </Block>


      {/* 6 · Assumptions */}
      <Block label="Assumptions" hint="every value editable" right="applied to the peer medians">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Step", "Adjustment", "P/BV", "EV/Sales"].map((h, i) => (
                <th
                  key={h}
                  className={`border-b border-[#F2F4F6] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                    i === 0 ? "text-left" : "text-right"
                  } ${i === 1 ? "w-[150px]" : i > 1 ? "w-[106px]" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ladder.map((r) => (
              <tr key={r.step}>
                <td className="border-b border-[#F2F4F6] py-[7px] font-medium text-[#0F1B33]">
                  {r.step}
                </td>
                <td className="border-b border-[#F2F4F6] py-[7px] text-right">{r.adj}</td>
                <td className="border-b border-[#F2F4F6] py-[7px] text-right tabular-nums">
                  {fmtMult(r.pbv)}
                </td>
                <td className="border-b border-[#F2F4F6] py-[7px] text-right tabular-nums">
                  {fmtMult(r.evs)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="rounded-l-[7px] border-t border-[#DDE3F2] bg-[#F5F7FD] py-[9px] pl-2.5 font-semibold text-[#1E3A8A]">
                Effective multiple
              </td>
              <td className="border-t border-[#DDE3F2] bg-[#F5F7FD] py-[9px] text-right text-muted-foreground">
                ±{BAND_PCT}%
              </td>
              <td className="border-t border-[#DDE3F2] bg-[#F5F7FD] py-[9px] text-right font-semibold tabular-nums text-[#1E3A8A]">
                {result.effective.pbv
                  ? `${fmtMult(result.effective.pbv.low)} – ${fmtMult(result.effective.pbv.high)}`
                  : "—"}
              </td>
              <td className="rounded-r-[7px] border-t border-[#DDE3F2] bg-[#F5F7FD] py-[9px] pr-2.5 text-right font-semibold tabular-nums text-[#1E3A8A]">
                {result.effective.evSales
                  ? `${fmtMult(result.effective.evSales.low)} – ${fmtMult(result.effective.evSales.high)}`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Every adjustment is editable. Control premium is off by default — apply it only when
          valuing a controlling stake.
        </p>
      </Block>

      {/* 7 · Footer */}
      <div className="mt-[13px] border-t border-[#F2F4F6] pt-2.5 text-[11px] leading-[1.5] text-muted-foreground">
        Indicative range on stated assumptions — not a valuation, not financial advice.
        <br />
        {year ? `Filing FY${year} · ` : ""}
        {refreshText ? `peer set ${refreshText} · ` : ""}
        discounts: {discounts.marketability}% marketability, {discounts.size}% size,{" "}
        {discounts.growth !== 0 ? `${discounts.growth}% growth differential, ` : ""}
        {discounts.control === null
          ? "no control premium"
          : `${discounts.control}% control premium`}
        .
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Num({
  v,
  suffix = "",
  median,
}: {
  v: number | null;
  suffix?: string;
  median?: boolean;
}) {
  return (
    <td
      className={`px-2.5 py-[7px] text-right tabular-nums ${
        median ? "border-t border-[#DDE3F2]" : "border-b border-[#F2F4F6]"
      }`}
    >
      {v === null || v === undefined
        ? "—"
        : `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`}
    </td>
  );
}

/** Join names as "A and B" / "A, B and C". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The drawn scale: the included methods, widened to hold the book marker. */
function chartDomain(
  spread: { low: number; high: number },
  book: number | null,
): { low: number; high: number } {
  const low = book === null ? spread.low : Math.min(spread.low, book);
  const high = book === null ? spread.high : Math.max(spread.high, book);
  return high > low ? { low, high } : { low, high: low + 1 };
}

function Axis({
  spread,
  indicative,
  book,
  tails,
}: {
  spread: { low: number; high: number };
  indicative: { low: number; high: number } | null;
  book: number | null;
  tails: { name: string; low: number; high: number }[];
}) {
  const d = chartDomain(spread, book);
  const pos = (v: number) => scalePos(v, d.low, d.high) * 0.86 + 4;
  const coreLeft = indicative ? pos(indicative.low) : 0;
  const coreWidth = indicative ? Math.max(1.5, pos(indicative.high) - coreLeft) : 0;
  return (
    <div className="relative mt-3 h-[62px]">
      <div className="absolute left-0 right-0 top-7 h-px bg-[#EAECEF]" />
      <div
        className="absolute top-[25px] h-[7px] rounded-[4px] opacity-90"
        style={{
          left: `${pos(spread.low)}%`,
          width: `${Math.max(1, pos(spread.high) - pos(spread.low))}%`,
          background: "linear-gradient(90deg,#D8E6F6,#A8BFE2)",
        }}
      />
      {indicative && (
        <div
          className="absolute top-[25px] z-[2] h-[7px] rounded-[4px]"
          style={{
            left: `${coreLeft}%`,
            width: `${coreWidth}%`,
            background: "linear-gradient(90deg,#2D4B9E,#16296A)",
          }}
        />
      )}
      {book !== null && (
        <>
          <div
            className="absolute top-[18px] z-[3] h-[21px] w-0 border-l-[1.5px] border-dashed border-[#8A93A0]"
            style={{ left: `${pos(book)}%` }}
          />
          <div
            className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
            style={{ left: `${pos(book)}%` }}
          >
            book {fmtMoney(book)}
          </div>
        </>
      )}
      {[spread.low, spread.high].map((v, i) => (
        <div
          key={i}
          className="absolute top-1 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
          style={{ left: `${pos(v)}%` }}
        >
          {fmtMoney(v)}
        </div>
      ))}
      {indicative &&
        [indicative.low, indicative.high].map((v, i) => (
          <div
            key={i}
            className="absolute top-[38px] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-[#1E3A8A]"
            style={{ left: `${i === 0 ? coreLeft : coreLeft + coreWidth}%` }}
          >
            {fmtMoney(v)}
          </div>
        ))}
      {tails.length > 0 && (
        <div className="absolute right-0 top-[42px] whitespace-nowrap text-[11px] font-semibold text-[#B45309]">
          {tails
            .map((t) => `→ tail ${fmtMoney(t.low)}–${fmtMoney(t.high)}`)
            .join("  ")}
        </div>
      )}
    </div>
  );
}

function MethodRow({
  row,
  domain,
  zone,
  reference,
  tail,
  showMedianCap,
}: {
  row: {
    name: string;
    input: string | null;
    low: number | null;
    high: number | null;
    status: string;
    point: boolean;
  };
  domain: { low: number; high: number };
  zone: { low: number; high: number } | null;
  reference: number | null;
  tail: { ratio: number | null } | null;
  showMedianCap: boolean;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, scalePos(v, domain.low, domain.high)));
  const left = clamp(row.low!);
  const width = Math.max(1.5, clamp(row.high!) - left);
  const pale = row.status === "low confidence";
  const isTail = tail !== null;

  return (
    <div className="grid grid-cols-[132px_1fr_128px] items-center gap-3.5 border-b border-[#F2F4F6] py-2.5 last:border-b-0">
      <div
        className={`text-[12.5px] font-medium leading-[1.3] ${
          isTail ? "text-[#A5ADB8]" : "text-[#0F1B33]"
        }`}
      >
        {row.name}
        {row.input && (
          <small
            className={`block text-[11px] font-normal leading-[1.35] ${
              isTail ? "text-[#B7BEC8]" : "text-muted-foreground"
            }`}
          >
            {row.input}
          </small>
        )}
      </div>
      <div
        className={`relative h-4 ${row.point ? "" : "before:absolute before:inset-x-0 before:top-[5.5px] before:h-[5px] before:rounded-[3px] before:bg-[#EFF1F5] before:content-['']"}`}
      >
        {/* The accepted zone and the reference, drawn behind the bar. */}
        {zone && (
          <div
            className="absolute inset-y-0 z-0 border-l border-dotted border-[#C9D3E8] bg-[#1E3A8A]/[0.035]"
            style={{ left: `${clamp(zone.low)}%`, width: `${clamp(zone.high) - clamp(zone.low)}%` }}
          />
        )}
        {reference !== null && (
          <div
            className="absolute inset-y-0 z-[1] w-0 border-l border-dotted border-[#7C8FBF]"
            style={{ left: `${clamp(reference)}%` }}
          >
            {showMedianCap && (
              <span className="absolute -top-3 -translate-x-1/2 whitespace-nowrap text-[9.5px] text-[#7C8FBF]">
                median of midpoints {fmtMoney(reference)}
              </span>
            )}
          </div>
        )}

        {row.point ? (
          <div
            className="absolute -top-1 bottom-[-4px] z-[2] w-0 border-l-[1.5px] border-dashed border-[#8A93A0]"
            style={{ left: `${clamp(row.low!)}%` }}
          />
        ) : isTail ? (
          <div className="absolute right-0 top-0 z-[2] flex h-4 items-center gap-[5px] text-[10.5px] font-semibold text-[#B45309]">
            <i
              className="h-[5px] w-[22px] rounded-[3px]"
              style={{
                background:
                  "repeating-linear-gradient(90deg,#E9D4B4 0 4px,transparent 4px 7px)",
              }}
            />
            off scale
          </div>
        ) : (
          <>
            <div
              className="absolute top-[5.5px] z-[2] h-[5px] rounded-[3px]"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: pale
                  ? "linear-gradient(90deg,#D8E6F6 0%,#9DB8DE 50%,#4A66A8 100%)"
                  : "linear-gradient(90deg,#BBD3F0 0%,#6E93CF 50%,#1E3A8A 100%)",
                opacity: pale ? 0.72 : 1,
              }}
            />
            {!pale && (
              <>
                <Cap left={left} />
                <Cap left={left + width} />
              </>
            )}
          </>
        )}
      </div>
      <div
        className={`text-right text-[12.5px] leading-[1.3] tabular-nums ${
          isTail ? "text-[#A5ADB8]" : "text-[#0F1B33]"
        }`}
      >
        {row.point ? fmtMoney(row.low) : `${fmtMoney(row.low)} – ${fmtMoney(row.high)}`}
        {row.point && (
          <small className="block text-[10.5px] text-muted-foreground">not in the range</small>
        )}
        {isTail && (
          <small className="block text-[10.5px] font-semibold text-[#B45309]">
            tail · {tail!.ratio === null ? "—" : `${tail!.ratio.toFixed(1)}×`} the median
          </small>
        )}
        {pale && !isTail && (
          <small className="block text-[10.5px] text-[#B45309]">low confidence · included</small>
        )}
      </div>
    </div>
  );
}


function Cap({ left }: { left: number }) {
  return (
    <div
      className="absolute top-[2.5px] z-[3] h-[11px] w-[1.5px] rounded-[1px] opacity-65"
      style={{ left: `${left}%`, background: ACC }}
    />
  );
}

function BenchRow({
  label,
  own,
  ownRange,
  estimated,
  sub,
  tooltip,
  peer,
  unit = "%",
  blocked,
  blockedNote,
  lowerIsBetter,
}: {
  label: string;
  own: number | null;
  /** An estimated bracket shown in place of a single figure. */
  ownRange?: { low: number; high: number } | null;
  estimated?: boolean;
  sub?: string | null;
  tooltip?: string;
  peer: number | null;
  unit?: string;
  blocked?: boolean;
  blockedNote?: string;
  lowerIsBetter?: boolean;
}) {
  const fmt = (v: number | null) =>
    v === null ? "—" : unit === "%" ? fmtPct(v) : `${v.toFixed(2)}${unit}`;
  const gap = own !== null && peer !== null ? own - peer : null;
  const good = gap === null ? null : lowerIsBetter ? gap < 0 : gap > 0;
  const maxV = Math.max(Math.abs(own ?? ownRange?.high ?? 0), Math.abs(peer ?? 0), 1);

  // A range never overstates the difference: the nearest bound is used, so the
  // gap is the smallest one the estimate allows.
  const rangeGap = (() => {
    if (!ownRange || peer === null) return null;
    if (ownRange.high < peer) return `≥ ${(peer - ownRange.high).toFixed(1)} pts below`;
    if (ownRange.low > peer) return `≥ ${(ownRange.low - peer).toFixed(1)} pts above`;
    return "overlaps peer median";
  })();

  return (
    <tr>
      <td
        className={`border-b border-[#F2F4F6] py-[7px] font-medium ${
          blocked ? "text-muted-foreground" : "text-[#0F1B33]"
        }`}
      >
        {label}
      </td>
      <td
        className={`border-b border-[#F2F4F6] py-[7px] text-right font-semibold tabular-nums ${
          blocked || ownRange ? "text-[#B45309]" : "text-[#0F1B33]"
        }`}
      >
        {blocked ? (
          "blocked"
        ) : ownRange ? (
          <span title={tooltip} className="cursor-help">
            {estimated ? "est. " : ""}
            {ownRange.low.toFixed(1)} – {ownRange.high.toFixed(1)}%
            {sub && (
              <small className="block text-[10.5px] font-normal text-muted-foreground">{sub}</small>
            )}
          </span>
        ) : (
          fmt(own)
        )}
      </td>
      <td className="border-b border-[#F2F4F6] py-[7px] text-right tabular-nums text-muted-foreground">
        {fmt(peer)}
      </td>
      <td className="border-b border-[#F2F4F6] py-[7px] text-right">
        {!blocked && own !== null && peer !== null && (
          <span className="relative inline-block h-[3px] w-12 rounded-[2px] bg-[#F2F4F6]">
            <i
              className="absolute top-0 h-[3px] rounded-[2px] bg-[#1E3A8A]"
              style={{ width: `${Math.min(100, (Math.abs(own) / maxV) * 100)}%` }}
            />
            <i
              className="absolute h-[3px] rounded-[2px] bg-[#D5DAE0] opacity-55"
              style={{ top: "-5px", width: `${Math.min(100, (Math.abs(peer) / maxV) * 100)}%` }}
            />
          </span>
        )}
      </td>
      <td
        className={`border-b border-[#F2F4F6] py-[7px] text-right text-[12px] font-semibold ${
          blocked || rangeGap
            ? "text-[#B45309]"
            : good === null
              ? "text-muted-foreground"
              : good
                ? "text-[#15803D]"
                : "text-[#B91C1C]"
        }`}
      >
        {blocked
          ? blockedNote
          : rangeGap
            ? rangeGap
            : gap === null
              ? "—"
              : unit === "%"
                ? `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)} pts`
                : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)}×`}
      </td>
    </tr>
  );
}

