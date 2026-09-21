/**
 * Valuation → Methods. Two plain lists: what each method can do, and what the
 * filing actually carries. No cards.
 */
import { fmtMoney, fmtPct, type FilingInputs, type ValuationResult } from "@/lib/valuation";

const STATUS_TONE: Record<string, string> = {
  usable: "text-[#15803D]",
  "low confidence": "text-[#B45309]",
  blocked: "text-[#B45309]",
  "out of scope": "text-muted-foreground",
};

export function ValuationMethods({
  result,
  inputs,
}: {
  result: ValuationResult;
  inputs: FilingInputs;
}) {
  const daText =
    inputs.daLow === null || inputs.daHigh === null
      ? null
      : inputs.ebitdaEstimated
        ? `estimated, ${fmtMoney(inputs.daLow)} – ${fmtMoney(inputs.daHigh)}`
        : `reported, ${fmtMoney(inputs.daLow)}`;
  const ebitdaText =
    inputs.ebitdaLow === null || inputs.ebitdaHigh === null
      ? null
      : inputs.ebitdaEstimated
        ? `${fmtMoney(inputs.ebitdaLow)} – ${fmtMoney(inputs.ebitdaHigh)}`
        : fmtMoney(inputs.ebitdaLow);

  const rows: [string, string | null, boolean?][] = [
    ["Revenue", inputs.revenue === null ? null : fmtMoney(inputs.revenue)],
    ["Gross profit", inputs.grossProfit === null ? null : fmtMoney(inputs.grossProfit)],
    ["Net profit", inputs.netProfit === null ? null : fmtMoney(inputs.netProfit)],
    ["Equity", inputs.equity === null ? null : fmtMoney(inputs.equity)],
    ["Total assets", inputs.totalAssets === null ? null : fmtMoney(inputs.totalAssets)],
    [
      "Total liabilities",
      inputs.totalLiabilities === null ? null : fmtMoney(inputs.totalLiabilities),
    ],
    ["Depreciation & amortisation", daText, inputs.ebitdaEstimated],
    ["EBIT", inputs.ebit === null ? null : fmtMoney(inputs.ebit)],
    ["EBITDA (derived)", ebitdaText, inputs.ebitdaEstimated],
    ["Net margin", inputs.netMarginPct === null ? null : fmtPct(inputs.netMarginPct)],
  ];

  const notes: string[] = [];
  if (inputs.reconciliationDiff !== null) {
    notes.push(
      `Profit before tax is ${fmtMoney(Math.abs(inputs.reconciliationDiff))} ${
        inputs.reconciliationDiff > 0 ? "higher" : "lower"
      } than revenue minus expenses — likely other income or an associate's share of profit, which the filing doesn't break out. EBIT is taken from reported profit before tax.`,
    );
  }
  if (inputs.revenueOrderNote) {
    notes.push(
      "Total revenue is below sales revenue in this filing. Sales revenue is used as the denominator.",
    );
  }


  return (
    <div className="grid gap-7 md:grid-cols-2">
      <section>
        <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#1E3A8A] opacity-75">
          Methods
        </h3>
        {result.methods.map((m) => (
          <div
            key={m.key}
            className="flex items-start gap-3 border-b border-[#F2F4F6] py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-[#0F1B33]">{m.name}</div>
              <div className="text-[11px] text-muted-foreground">{m.reason}</div>
            </div>
            <span className={`shrink-0 text-[11.5px] font-semibold ${STATUS_TONE[m.status]}`}>
              {m.status}
            </span>
          </div>
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#1E3A8A] opacity-75">
          Inputs from the filing
        </h3>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline gap-3 border-b border-[#F2F4F6] py-2.5 last:border-b-0"
          >
            <span className="flex-1 text-[12.5px] font-medium text-[#0F1B33]">{label}</span>
            <span className="text-[12.5px] tabular-nums text-[#0F1B33]">{value ?? ""}</span>
            <span
              className={`w-[92px] shrink-0 text-right text-[11.5px] ${
                value ? "text-[#15803D]" : "text-[#B45309]"
              }`}
            >
              {value ? "present" : "not captured"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
