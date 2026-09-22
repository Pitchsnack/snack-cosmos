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
import {
  direction,
  type Adjustment,
  type Normalisation,
  type Stake,
} from "@/lib/valuation-adjustments";

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
  normalisation,
  stake,
  adjustments = [],
  matchLabel = null,
  selectedPeerId = null,
  onSelectPeer,
  canChoosePeer = false,
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
  /** Earnings normalisation from the Adjustments tab. */
  normalisation?: Normalisation;
  stake?: Stake;
  adjustments?: Adjustment[];
  /** Sector · business model of the matched peer set. */
  matchLabel?: string | null;
  /** The one peer chosen for the Benchmark, by listed company id. */
  selectedPeerId?: string | null;
  onSelectPeer?: (id: string | null) => void;
  canChoosePeer?: boolean;
}) {
  const [showPeers, setShowPeers] = useState(true);
  const { indicative, spread } = result;
  const adjApplied = Boolean(normalisation?.applied);
  const minorityRecorded = stake === "minority" && adjustments.length > 0;
  const applicableAdjustments = adjustments.filter((a) => direction(a.type) !== "none");

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

  /** Peer medians for the Benchmark rows, with how many peers each one used. */
  const bench = benchmarkMedians(peers);

  /** The chosen peer, and the set list ordered closest in revenue first. */
  const peerKey = (p: Peer) => p.listedCompanyId ?? p.id ?? p.companyName;
  const chosenPeer = peers.find((p) => peerKey(p) === selectedPeerId) ?? null;
  const ownRevenueThbM = inputs.revenue === null ? null : inputs.revenue / 1_000_000;
  const peerOptions = [...peers]
    .map((p) => ({
      key: peerKey(p),
      peer: p,
      distance:
        ownRevenueThbM === null || typeof p.revenueThbM !== "number"
          ? Number.POSITIVE_INFINITY
          : Math.abs(p.revenueThbM - ownRevenueThbM),
    }))
    .sort((a, b) => a.distance - b.distance);

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
        stake === "minority" ? (
          <span className="text-[11.5px] text-muted-foreground">
            applies to controlling stakes only
          </span>
        ) : discounts.control === null ? (
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
          {adjApplied && normalisation && (
            <span className="font-semibold text-[#1E3A8A]">
              {" · "}
              {normalisation.netEffect >= 0 ? "+" : "−"}
              {fmtMoney(Math.abs(normalisation.netEffect))} profit
              {normalisation.revenueAdjustment !== 0
                ? ` and ${normalisation.revenueAdjustment >= 0 ? "+" : "−"}${fmtMoney(
                    Math.abs(normalisation.revenueAdjustment),
                  )} revenue`
                : ""}{" "}
              from {normalisation.appliedCount} adjustment
              {normalisation.appliedCount === 1 ? "" : "s"} · controlling stake
            </span>
          )}
          {year ? ` · filing FY${year}` : ""}
        </div>
        {minorityRecorded && (
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            {applicableAdjustments.length} adjustment
            {applicableAdjustments.length === 1 ? "" : "s"} recorded, not applied — minority stake
          </div>
        )}
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
          The axis starts at zero, so each range shows at its real size. A tail is named at the edge
          rather than stretching the scale.
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
        <div className="-mx-3 -mt-3 mb-0 border-b border-[#EAECEF] px-4 py-2.5 text-[12px] text-muted-foreground">
          Peer median of <b className="font-semibold text-[#0F1B33]">{peers.length} companies</b>
          {matchLabel ? ` · ${matchLabel}` : ""} · reported figures
          {year ? `, FY${year}` : ""}
        </div>
        <table className="w-full table-fixed border-collapse text-[13px]">
          <colgroup>
            <col className="w-[200px]" />
            <col className="w-[118px]" />
            <col className="w-[96px]" />
            <col className="w-[112px]" />
            <col className="w-[90px]" />
            <col className="w-[118px]" />
            <col className="w-[158px]" />
          </colgroup>
          <thead>
            <tr>
              <th />
              <th />
              <th
                colSpan={2}
                className="px-3 pt-2 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-[#1E3A8A]"
              >
                <span className="block border-b border-[#DDE3F2] pb-[5px]">Peer median</span>
              </th>
              <th
                colSpan={2}
                className="border-x border-[#E2D8FB] bg-[#F7F3FE] px-3 pt-2 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-[#6D28D9]"
              >
                <span className="flex items-center justify-center gap-1.5 border-b border-[#E2D8FB] pb-[5px]">
                  <PeerPicker
                    options={peerOptions}
                    chosen={chosenPeer}
                    canEdit={canChoosePeer}
                    onChoose={(id) => onSelectPeer?.(id)}
                  />
                </span>
              </th>
              <th />
            </tr>
            <tr>
              <th className="border-b border-[#EAECEF] px-3 pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Metric
              </th>
              <th className="border-b border-[#EAECEF] px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0F1B33]">
                {startupName}
              </th>
              <th className="border-b border-l border-[#EAECEF] px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Median
              </th>
              <th className="border-b border-r border-[#EAECEF] px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Gap
              </th>
              <th className="border-x border-b border-[#E2D8FB] bg-[#F7F3FE] px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8B6FD6]">
                {chosenPeer ? (chosenPeer.ticker ?? chosenPeer.companyName) : "Peer"}
              </th>
              <th className="border-r border-b border-[#E2D8FB] bg-[#F7F3FE] px-3 pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8B6FD6]">
                Gap
              </th>
              <th className="border-b border-[#EAECEF] px-3 pb-2 text-[10px] font-medium normal-case tracking-[0.03em] text-muted-foreground">
                <span className="flex justify-between">
                  <span>worse</span>
                  <span>better</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <BenchSection label="Profitability" />
            <BenchRow
              label="Gross margin"
              own={ratio("gross_profit_margin") ?? inputs.grossMarginPct}
              peer={bench.grossMarginPct.value}
              peerCount={bench.grossMarginPct.count}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.grossMarginPct ?? null}
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
                  ? `floor ${fmtPct(inputs.ebitMarginPct, 1)} · EBIT`
                  : null
              }
              tooltip="Estimated. The cash flow statement is empty, so D&A is bracketed from the balance sheet: equipment depreciated over 3–5 years, with other non-current assets amortised over 5 years at most. EBIT is exact."
              blocked={inputs.ebitdaLow === null}
              blockedNote="needs D&A"
              peer={result.medians.ebitdaMarginPct}
              peerCount={peers.filter((p) => typeof p.ebitdaMarginPct === "number").length}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.ebitdaMarginPct ?? null}
            />

            <BenchRow
              label="Net margin"
              own={ratio("net_profit_margin") ?? inputs.netMarginPct}
              peer={bench.netMarginPct.value}
              peerCount={bench.netMarginPct.count}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.netMarginPct ?? null}
            />
            <BenchRow
              label="Return on equity"
              own={ratio("return_on_equity")}
              peer={bench.roePct.value}
              peerCount={bench.roePct.count}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.roePct ?? null}
            />
            <BenchSection label="Balance sheet" />
            <BenchRow
              label="Debt to equity"
              labelSub="lower is better"
              own={ratio("debt_to_equity_ratio")}
              peer={bench.debtEquity.value}
              peerCount={bench.debtEquity.count}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.debtEquity ?? null}
              unit="×"
              lowerIsBetter
            />
            <BenchSection label="Growth" />
            <BenchRow
              label="Revenue growth"
              own={revenueGrowth}
              peer={bench.revenueGrowthPct.value}
              peerCount={bench.revenueGrowthPct.count}
              chosen={chosenPeer}
              chosenValue={chosenPeer?.revenueGrowthPct ?? null}
              last
            />
          </tbody>
        </table>
        <div className="-mx-3 -mb-3 mt-3 flex flex-wrap gap-[18px] border-t border-[#EAECEF] px-4 py-2.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-[6px] w-3.5 rounded-[3px] bg-[#E8A8A8]" />
            <i className="inline-block h-[6px] w-3.5 rounded-[3px] bg-[#9ED3B1]" />
            {startupName} vs median
          </span>
          {chosenPeer && (
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#6D28D9] bg-white" />
              <b className="font-semibold text-[#6D28D9]">
                {chosenPeer.ticker ?? chosenPeer.companyName}
              </b>{" "}
              vs median
            </span>
          )}
          <span>
            Gaps are {startupName} minus the comparison. Green means {startupName} is better — for
            debt to equity, lower. A peer median shows only where the peer set carries that metric.
          </span>
        </div>
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
            {orderedRows(result).map((row, i) => (
              <MethodRow
                key={row.key}
                row={row}
                domain={chartDomain(spread, result.bookValue)}
                zone={result.zone}
                reference={result.reference}
                tail={result.tails.find((t) => t.key === row.key) ?? null}
                showMedianCap={i === 0}
                offScale={row.point && chartDomain(spread, result.bookValue).bookOffScale}
              />
            ))}
            {/* The answer and its working share one box. */}
            <div className="mt-3 overflow-hidden rounded-[8px] border border-[#DDE3F2] bg-white">
            {indicative && (
              <div className="grid grid-cols-[132px_1fr_128px] items-center gap-3.5 border-b border-[#DDE3F2] bg-[#F5F7FD] px-3 py-2.5">
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
              <div className="px-3 py-2.5">
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
                    {/* Included methods first, then tails; book value last. */}
                    {[...result.candidates]
                      .sort((a, b) => Number(Boolean(a.tail)) - Number(Boolean(b.tail)))
                      .map((c) => (
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
            </div>
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
        {adjApplied && (discounts.control ?? 0) > 0 && (
          <p className="mt-2 text-[11.5px] text-[#B45309]">
            Adjustments and a control premium can count the same gain twice — both reflect what a
            controlling owner can change.
          </p>
        )}
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
        {adjApplied && applicableAdjustments.length > 0 && (
          <>
            <br />
            Applied adjustments:{" "}
            {applicableAdjustments
              .map(
                (a) =>
                  `${a.description} ${direction(a.type) === "add_back" ? "+" : "−"}${fmtMoney(
                    a.amount,
                  )}`,
              )
              .join(" · ")}
            .
          </>
        )}
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

/** Book value, then the included methods, then the tails. */
function orderedRows(result: ValuationResult) {
  const tailKeys = new Set(result.tails.map((t) => t.key));
  const book = result.drawn.filter((r) => r.point);
  const included = result.drawn.filter((r) => !r.point && !tailKeys.has(r.key));
  const tails = result.drawn.filter((r) => !r.point && tailKeys.has(r.key));
  return [...book, ...included, ...tails];
}

/** Next round number at or above a value — 887M → 1.0B, 670M → 800M. */
function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= s * mag) return s * mag;
  }
  return 10 * mag;
}

/**
 * The drawn scale. It always starts at zero so a range shows at its real size,
 * and reaches the next round number above the included methods and book value.
 * Book value only leaves the scale when it would squash the ranges (> 2× the
 * highest included value); tails are always off scale.
 */
function chartDomain(
  spread: { low: number; high: number },
  book: number | null,
): { low: number; high: number; bookOffScale: boolean } {
  const bookOffScale = book !== null && book > spread.high * 2;
  const top = niceCeil(
    book === null || bookOffScale ? spread.high : Math.max(spread.high, book),
  );
  return { low: 0, high: top > 0 ? top : 1, bookOffScale };
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
      {book !== null &&
        (d.bookOffScale ? (
          <div className="absolute right-0 top-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            → book {fmtMoney(book)} (off scale)
          </div>
        ) : (
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
        ))}
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
  offScale,
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
  /** Book value sits so far above the ranges that drawing it would squash them. */
  offScale?: boolean;
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
          offScale ? (
            <div className="absolute right-0 top-0 z-[2] flex h-4 items-center gap-[5px] text-[10.5px] text-muted-foreground">
              <i className="h-[11px] w-0 border-l-[1.5px] border-dashed border-[#8A93A0]" />
              off scale
            </div>
          ) : (
            <div
              className="absolute -top-1 bottom-[-4px] z-[2] w-0 border-l-[1.5px] border-dashed border-[#8A93A0]"
              style={{ left: `${clamp(row.low!)}%` }}
            />
          )
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

/** A section heading that keeps both framing pairs unbroken. */
function BenchSection({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={2}
        className="px-3 pb-[5px] pt-[13px] text-[10px] font-bold uppercase tracking-[0.08em] text-[#1E3A8A]"
      >
        {label}
      </td>
      <td className="border-l border-[#E3E7ED]" />
      <td className="border-r border-[#E3E7ED]" />
      <td className="border-l border-[#E2D8FB] bg-[#F7F3FE]" />
      <td className="border-r border-[#E2D8FB] bg-[#F7F3FE]" />
      <td />
    </tr>
  );
}

/** Choosing the one peer shown beside the median. */
function PeerPicker({
  options,
  chosen,
  canEdit,
  onChoose,
}: {
  options: { key: string; peer: Peer; distance: number }[];
  chosen: Peer | null;
  canEdit: boolean;
  onChoose: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = options.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (o.peer.ticker ?? "").toLowerCase().includes(q) ||
      o.peer.companyName.toLowerCase().includes(q)
    );
  });

  return (
    <span className="relative inline-flex items-center gap-1.5">
      {chosen ? (
        <>
          <span className="text-[10px] font-bold tracking-[0.07em] text-[#6D28D9]">
            {chosen.ticker ?? chosen.companyName}
          </span>
          <span className="rounded-[3px] border border-[#E2D8FB] bg-white px-[5px] text-[9px] font-bold tracking-normal text-[#6D28D9]">
            {chosen.market}
          </span>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-[11px] font-normal normal-case tracking-normal text-[#B8A6E8]"
              >
                ▾ change
              </button>
              <button
                type="button"
                onClick={() => onChoose(null)}
                className="text-[11px] font-normal normal-case tracking-normal text-[#B8A6E8]"
                aria-label="clear chosen peer"
              >
                ✕
              </button>
            </>
          )}
        </>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-6 items-center gap-1.5 rounded-[6px] border border-dashed border-[#C9B8F3] bg-white px-2.5 text-[11.5px] font-semibold normal-case tracking-normal text-[#6D28D9]"
        >
          ＋ Add a peer
        </button>
      ) : (
        <span className="text-[11.5px] font-normal normal-case tracking-normal text-[#CBBFEF]">
          no peer chosen
        </span>
      )}

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+10px)] z-20 w-[320px] -translate-x-1/2 overflow-hidden rounded-[9px] border border-[#EAECEF] bg-white text-left font-normal normal-case tracking-normal shadow-[0_14px_32px_rgba(15,23,42,0.16)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the peer set…"
            className="m-2 h-[30px] w-[calc(100%-16px)] rounded-[7px] border border-[#CDD5E1] px-2.5 text-[12.5px] outline-none"
          />
          <div className="max-h-[260px] overflow-y-auto overscroll-contain pb-1">
            {shown.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-muted-foreground">No match.</div>
            )}
            {shown.map((o, i) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onChoose(o.key);
                  setOpen(false);
                  setQuery("");
                }}
                className="grid w-full grid-cols-[62px_1fr_auto] items-baseline gap-2 px-3 py-[7px] text-left text-[12.5px] text-[#0F1B33] hover:bg-[#F7F3FE]"
              >
                <b className="font-bold">{o.peer.ticker ?? "—"}</b>
                <span className="truncate text-[11.5px] text-muted-foreground">
                  {o.peer.companyName}
                  {i === 0 && query.trim() === "" && (
                    <span className="ml-1 rounded-[3px] bg-[#F7F3FE] px-[5px] text-[9.5px] font-bold text-[#6D28D9]">
                      closest
                    </span>
                  )}
                </span>
                <em className="not-italic text-[11.5px] tabular-nums text-muted-foreground">
                  {typeof o.peer.revenueThbM === "number" ? `${o.peer.revenueThbM.toFixed(0)}m` : "—"}
                </em>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function BenchRow({
  label,
  labelSub,
  own,
  ownRange,
  estimated,
  sub,
  tooltip,
  peer,
  peerCount,
  chosen,
  chosenValue,
  unit = "%",
  blocked,
  blockedNote,
  lowerIsBetter,
  last,
}: {
  label: string;
  labelSub?: string;
  own: number | null;
  /** An estimated bracket shown in place of a single figure. */
  ownRange?: { low: number; high: number } | null;
  estimated?: boolean;
  sub?: string | null;
  tooltip?: string;
  peer: number | null;
  /** How many peers carried a usable value for this metric. */
  peerCount?: number;
  /** The one chosen peer, if any. */
  chosen?: Peer | null;
  chosenValue?: number | null;
  unit?: string;
  blocked?: boolean;
  blockedNote?: string;
  lowerIsBetter?: boolean;
  last?: boolean;
}) {
  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : unit === "%" ? fmtPct(v) : `${v.toFixed(2)}${unit}`;
  /** Fewer than three usable values is a median worth doubting. */
  const thin = peer !== null && peerCount !== undefined && peerCount < 3;
  const border = last ? "" : "border-b border-[#F2F4F6]";

  /**
   * Gap is always this company minus the comparison. Where the company's own
   * figure is an estimated range, the nearest bound is used, so the gap states
   * the smallest difference the estimate allows.
   */
  const gapTo = (
    comparison: number | null | undefined,
  ): { text: string; good: boolean | null } | null => {
    if (comparison === null || comparison === undefined) return null;
    if (ownRange) {
      if (ownRange.high < comparison)
        return {
          text: `≥ ${(comparison - ownRange.high).toFixed(1)} below`,
          good: Boolean(lowerIsBetter),
        };
      if (ownRange.low > comparison)
        return {
          text: `≥ ${(ownRange.low - comparison).toFixed(1)} above`,
          good: !lowerIsBetter,
        };
      return { text: "overlaps", good: null };
    }
    if (own === null) return null;
    const gap = own - comparison;
    return {
      text:
        unit === "%"
          ? `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)} pts`
          : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)}×`,
      good: lowerIsBetter ? gap < 0 : gap > 0,
    };
  };

  const gapTone = (g: { good: boolean | null } | null) =>
    g === null || g.good === null
      ? "text-muted-foreground"
      : g.good
        ? "text-[#15803D]"
        : "text-[#B91C1C]";

  const medianGap = blocked ? null : gapTo(peer);
  const peerGap = blocked ? null : gapTo(chosenValue);

  // Bar: centred on the median, ±35 points to the edge (±1.0× for multiples).
  const scale = unit === "×" ? 1 : 35;
  const ownFigure = ownRange ? ownRange.high : own;
  const better =
    peer === null || ownFigure === null
      ? null
      : lowerIsBetter
        ? peer - ownFigure
        : ownFigure - peer;
  const peerBetter =
    peer === null || chosenValue === null || chosenValue === undefined
      ? null
      : lowerIsBetter
        ? peer - chosenValue
        : chosenValue - peer;
  const half = (v: number) => Math.min(50, (Math.abs(v) / scale) * 50);

  return (
    <tr>
      <td
        className={`h-[44px] px-3 align-middle font-medium ${border} ${
          blocked ? "text-muted-foreground" : "text-[#0F1B33]"
        }`}
      >
        {label}
        {labelSub && (
          <small className="block text-[10.5px] font-normal text-muted-foreground">
            {labelSub}
          </small>
        )}
      </td>
      <td
        className={`h-[44px] whitespace-nowrap px-3 text-right align-middle font-bold tabular-nums ${border} ${
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
      <td
        className={`h-[44px] whitespace-nowrap border-l border-[#E3E7ED] px-3 text-right align-middle tabular-nums ${border} ${
          thin ? "text-[#B45309]" : "text-muted-foreground"
        }`}
      >
        {fmt(peer)}
        {peer !== null && peerCount !== undefined && (
          <small
            className={`block text-[10.5px] font-normal ${
              thin ? "text-[#B45309]" : "text-muted-foreground"
            }`}
          >
            {thin
              ? `thin · ${peerCount} value${peerCount === 1 ? "" : "s"}`
              : `median of ${peerCount}`}
          </small>
        )}
      </td>
      <td
        className={`h-[44px] whitespace-nowrap border-r border-[#E3E7ED] px-3 text-right align-middle text-[12.5px] font-semibold tabular-nums ${border} ${
          blocked ? "text-[#B45309]" : gapTone(medianGap)
        }`}
      >
        {blocked ? blockedNote : (medianGap?.text ?? "—")}
      </td>
      <td
        className={`h-[44px] whitespace-nowrap border-l border-[#E2D8FB] bg-[#F7F3FE] px-3 text-right align-middle font-semibold tabular-nums ${border} ${
          chosen ? "text-[#6D28D9]" : "text-center text-[#CBBFEF]"
        }`}
      >
        {chosen ? fmt(chosenValue) : "—"}
      </td>
      <td
        className={`h-[44px] whitespace-nowrap border-r border-[#E2D8FB] bg-[#F7F3FE] px-3 text-right align-middle text-[12.5px] font-semibold tabular-nums ${border} ${
          chosen && !blocked ? gapTone(peerGap) : "text-center text-[#CBBFEF]"
        }`}
      >
        {chosen ? (blocked ? blockedNote : (peerGap?.text ?? "—")) : "—"}
      </td>
      <td className={`h-[44px] px-3 align-middle ${border}`}>
        <div className="relative h-2.5">
          <span className="absolute left-0 right-0 top-[4.5px] h-px bg-[#E6EAF0]" />
          <span className="absolute left-1/2 top-[-3px] h-4 w-px bg-[#C9D0DA]" />
          {better !== null && !blocked && (
            <i
              className="absolute top-[2px] h-1.5 rounded-[3px]"
              style={{
                width: `${half(better)}%`,
                ...(better >= 0 ? { left: "50%" } : { right: "50%" }),
                background: estimated
                  ? "repeating-linear-gradient(90deg,#E8A8A8 0 3px,#F6DADA 3px 6px)"
                  : better >= 0
                    ? "#9ED3B1"
                    : "#E8A8A8",
              }}
            />
          )}
          {peerBetter !== null && (
            <span
              className="absolute top-0 z-[2] -ml-[5px] h-2.5 w-2.5 rounded-full border-2 border-[#6D28D9] bg-white"
              style={{
                left: `${Math.max(0, Math.min(100, 50 + (peerBetter >= 0 ? half(peerBetter) : -half(peerBetter))))}%`,
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}


