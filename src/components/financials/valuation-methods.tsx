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
  const rows: [string, string | null][] = [
    ["Revenue", inputs.revenue === null ? null : fmtMoney(inputs.revenue)],
    ["Net profit", inputs.netProfit === null ? null : fmtMoney(inputs.netProfit)],
    ["Equity", inputs.equity === null ? null : fmtMoney(inputs.equity)],
    ["Total assets", inputs.totalAssets === null ? null : fmtMoney(inputs.totalAssets)],
    [
      "Total liabilities",
      inputs.totalLiabilities === null ? null : fmtMoney(inputs.totalLiabilities),
    ],
    ["Depreciation & amortisation", inputs.da === null ? null : fmtMoney(inputs.da)],
    ["EBITDA (derived)", inputs.ebitda === null ? null : fmtMoney(inputs.ebitda)],
    ["Net margin", inputs.netMarginPct === null ? null : fmtPct(inputs.netMarginPct)],
  ];

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
