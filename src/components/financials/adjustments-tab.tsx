/**
 * Valuation → Adjustments. Earnings normalisation: the owner's personal costs
 * added back, unpaid roles deducted, revenue differences normalised, and
 * unrecorded income recorded but never used. Adjustments apply only when a
 * controlling stake is being valued.
 */
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  deleteValuationAdjustment,
  saveValuationAdjustment,
  saveValuationSettings,
} from "@/lib/valuation-adjustments.functions";
import {
  ADJUSTMENT_TYPE_LABELS,
  FILING_LINE_LABELS,
  direction,
  effects,
  isRevenueType,
  normalise,
  type Adjustment,
  type AdjustmentType,
  type FilingLine,
  type Recurs,
  type Stake,
  type ValuationSettings,
} from "@/lib/valuation-adjustments";
import { fmtMoney, type ValuationResult } from "@/lib/valuation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const LINES: FilingLine[] = ["cost_of_goods_sold", "selling_admin", "other_expenses"];

/** Unrecorded income is a revenue item for display and for the add dialog. */
const isRevenueGroup = (t: AdjustmentType) => isRevenueType(t) || t === "unrecorded_income";
const DIALOG_REVENUE_TYPES: AdjustmentType[] = [
  "below_market_related_party",
  "revenue_elsewhere",
  "one_off_income",
  "unrecorded_income",
];
const DIALOG_EXPENSE_TYPES: AdjustmentType[] = [
  "booked_expense",
  "one_off_expense",
  "missing_cost",
];
const DIR_LABEL: Record<string, string> = {
  add_back: "add back",
  deduct: "deduct",
  none: "record only",
};

const thb = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const m = (v: number) => `${(v / 1_000_000).toFixed(2)}M`;

function Block({
  label,
  hint,
  right,
  children,
}: {
  label: string;
  hint?: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[13px] overflow-hidden rounded-[8px] border border-[#EAECEF] bg-white">
      <div className="flex items-baseline gap-[9px] bg-[#1E3A8A] px-3 py-2">
        <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-white">
          {label}
        </h3>
        {hint && <span className="text-[11px] text-[#B9C6E4]">{hint}</span>}
        {right && <span className="ml-auto text-[11px] text-[#B9C6E4]">{right}</span>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

interface Draft {
  id?: string;
  description: string;
  type: AdjustmentType;
  filingLine: FilingLine | null;
  amount: string;
  discountPct: string;
  costsAmount: string;
  recurs: Recurs;
}

const emptyExpenseDraft: Draft = {
  description: "",
  type: "booked_expense",
  filingLine: "selling_admin",
  amount: "",
  discountPct: "",
  costsAmount: "",
  recurs: "yearly",
};

const emptyRevenueDraft: Draft = {
  ...emptyExpenseDraft,
  type: "below_market_related_party",
  filingLine: "revenue",
};

const inputClass =
  "h-[30px] w-full rounded-[6px] border border-[#C7D3E6] bg-white px-2 text-[12.5px] text-[#0F1B33] outline-none focus:border-[#1E3A8A]";

/** What the user typed, read back as a sentence under the description. */
function inputSummary(a: Adjustment): string | null {
  switch (a.type) {
    case "below_market_related_party":
      return `${m(a.amount)} billed at ${a.discountPct ?? 0}% below market`;
    case "revenue_elsewhere":
      return `${m(a.amount)} of sales · ${m(a.costsAmount ?? 0)} of costs`;
    case "one_off_income":
      return `${m(a.amount)} received once`;
    default:
      return null;
  }
}

export function AdjustmentsTab({
  startupId,
  year,
  canEdit,
  adjustments,
  settings,
  filingLines,
  profitBeforeTax,
  reportedNetProfit,
  reportedRevenue,
  baseResult,
  adjustedResult,
  queryKey,
}: {
  startupId: string;
  year: number | undefined;
  canEdit: boolean;
  adjustments: Adjustment[];
  settings: ValuationSettings;
  /** Amount on each filing line for this year; null when not captured. */
  filingLines: Record<FilingLine, number | null>;
  profitBeforeTax: number | null;
  reportedNetProfit: number | null;
  reportedRevenue: number | null;
  /** Valuation without adjustments, and with them. */
  baseResult: ValuationResult;
  adjustedResult: ValuationResult;
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const saveAdj = useServerFn(saveValuationAdjustment);
  const removeAdj = useServerFn(deleteValuationAdjustment);
  const saveSettings = useServerFn(saveValuationSettings);

  const [draft, setDraft] = useState<Draft | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const settingsMut = useMutation({
    mutationFn: (patch: { stake?: Stake; taxRate?: number }) =>
      saveSettings({ data: { startupId, fiscalYear: year!, ...patch } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const saveMut = useMutation({
    mutationFn: (d: Draft) =>
      saveAdj({
        data: {
          id: d.id,
          startupId,
          fiscalYear: year!,
          description: d.description.trim(),
          type: d.type,
          filingLine: d.type === "unrecorded_income" ? null : d.filingLine,
          amount: Number(d.amount) || 0,
          discountPct: d.discountPct === "" ? null : Number(d.discountPct),
          costsAmount: d.costsAmount === "" ? null : Number(d.costsAmount),
          recurs: d.recurs,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      setError(null);
      await invalidate();
      toast.success("Adjustment saved");
    },
    onError: (e: Error) => {
      setError(e.message || "Could not save");
      toast.error(e.message || "Could not save");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeAdj({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Adjustment removed");
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove"),
  });

  const n = normalise(adjustments, settings, reportedNetProfit, reportedRevenue);
  const controlling = settings.stake === "controlling";

  const draftAdjustment = (d: Draft): Adjustment => ({
    id: d.id ?? "draft",
    description: d.description,
    type: d.type,
    filingLine: d.filingLine,
    amount: Number(d.amount) || 0,
    discountPct: d.discountPct === "" ? null : Number(d.discountPct),
    costsAmount: d.costsAmount === "" ? null : Number(d.costsAmount),
    recurs: d.recurs,
  });

  /** Everything that stops a row being saved. */
  const blockingCheck = (d: Draft): string | null => {
    if (!d.description.trim()) return "A description is required.";
    if (
      (d.type === "below_market_related_party" || d.type === "revenue_elsewhere") &&
      d.recurs === "one_off"
    )
      return "One-off revenue isn't added back — a valuation reflects yearly earnings. Record it as One-off income to deduct it, or mark it yearly if it recurs.";
    if (d.type === "below_market_related_party" && !(Number(d.discountPct) > 0))
      return "A discount to market price is required.";
    if (direction(d.type) === "add_back" && !isRevenueType(d.type) && d.filingLine) {
      const cap = filingLines[d.filingLine];
      const amount = Number(d.amount) || 0;
      if (cap !== null && amount > cap)
        return `${thb(amount)} is more than the ${thb(cap)} on ${FILING_LINE_LABELS[d.filingLine]}.`;
    }
    return null;
  };

  const overLine = adjustments.filter((a) => {
    if (direction(a.type) !== "add_back" || isRevenueType(a.type) || !a.filingLine) return false;
    const cap = filingLines[a.filingLine];
    return cap !== null && a.amount > cap;
  });

  const netApplied = Math.abs(n.netPreTax);
  const bigShare =
    controlling && profitBeforeTax !== null && profitBeforeTax > 0
      ? (netApplied / profitBeforeTax) * 100
      : null;

  const revenueShare =
    controlling && reportedRevenue !== null && reportedRevenue > 0
      ? (Math.abs(n.revenueAdjustment) / reportedRevenue) * 100
      : null;

  const submit = () => {
    if (!draft) return;
    const msg = blockingCheck(draft);
    if (msg) {
      setError(msg);
      return;
    }
    saveMut.mutate(draft);
  };

  const peBase = baseResult.methods.find((x) => x.key === "pe");
  const peAdj = adjustedResult.methods.find((x) => x.key === "pe");
  const peMoved =
    peBase?.low != null && peBase.high != null && peAdj?.low != null && peAdj.high != null;
  const revBase = baseResult.methods.find((x) => x.key === "evsales");
  const revAdj = adjustedResult.methods.find((x) => x.key === "evsales");
  const revMoved =
    revBase?.low != null && revBase.high != null && revAdj?.low != null && revAdj.high != null;

  if (!year) {
    return (
      <p className="text-[12.5px] text-muted-foreground">
        Adjustments need a fiscal year of filed figures.
      </p>
    );
  }

  const appliedRows = adjustments.filter((a) => direction(a.type) !== "none");
  const revenueRows = appliedRows.filter((a) => isRevenueType(a.type));
  const expenseRows = appliedRows.filter((a) => !isRevenueType(a.type));
  const recordedOnly = adjustments.filter((a) => direction(a.type) === "none");
  const afterTax = (v: number) => v * (1 - settings.taxRate / 100);

  const groupTotals = (rows: Adjustment[]) =>
    rows.reduce(
      (acc, a) => {
        const e = effects(a);
        return { revenue: acc.revenue + e.revenue, profit: acc.profit + e.profit };
      },
      { revenue: 0, profit: 0 },
    );

  const metaLine = (a: Adjustment) => {
    switch (a.type) {
      case "below_market_related_party":
        return (
          <>
            Related-party sales<Sep />
            {m(a.amount)} at {a.discountPct ?? 0}% below market
          </>
        );
      case "revenue_elsewhere":
        return (
          <>
            Booked elsewhere<Sep />
            {m(a.amount)} sales<Sep />
            {a.costsAmount === null ? (
              <span className="text-[#B45309]">no costs entered</span>
            ) : (
              `${m(a.costsAmount)} costs`
            )}
          </>
        );
      case "one_off_income":
        return <>One-off income</>;
      default:
        return (
          <>
            {ADJUSTMENT_TYPE_LABELS[a.type]}
            {a.filingLine && (
              <>
                <Sep />
                {FILING_LINE_LABELS[a.filingLine]}
              </>
            )}
          </>
        );
    }
  };

  const row = (a: Adjustment) => {
    const e = effects(a);
    return (
      <tr key={a.id} className="group">
        <td className="border-b border-[#F2F4F6] py-[9px] pl-[22px] pr-3 align-top">
          <div className="font-medium text-[#0F1B33]">{a.description}</div>
          <div className="mt-px text-[11px] text-muted-foreground">{metaLine(a)}</div>
        </td>
        <td className="whitespace-nowrap border-b border-[#F2F4F6] py-[9px] pr-3 align-top text-[11.5px] text-[#4B5563]">
          {a.recurs === "yearly" ? "Yearly" : "One-off"}
        </td>
        <Num value={e.revenue} />
        <Num value={e.profit} />
        <Num value={afterTax(e.profit)} />
        <td className="whitespace-nowrap border-b border-[#F2F4F6] py-[9px] text-right align-top">
          {canEdit && (
            <span className="text-[#C0C6CF] transition-colors group-hover:text-[#8A93A0]">
              <button
                type="button"
                aria-label="Edit adjustment"
                onClick={(ev) => openEdit(ev.currentTarget, a)}
                className="px-1"
              >
                ✎
              </button>
              <button
                type="button"
                aria-label="Delete adjustment"
                onClick={() => deleteMut.mutate(a.id)}
                className="px-1"
              >
                🗑
              </button>
            </span>
          )}
        </td>
      </tr>
    );
  };

  const openEdit = (el: HTMLElement, a: Adjustment) => {
    openerRef.current = el;
    setError(null);
    setDraft({
      id: a.id,
      description: a.description,
      type: a.type,
      filingLine: a.filingLine,
      amount: String(a.amount),
      discountPct: a.discountPct === null ? "" : String(a.discountPct),
      costsAmount: a.costsAmount === null ? "" : String(a.costsAmount),
      recurs: a.recurs,
    });
  };

  const groupRow = (label: string, rows: Adjustment[], revenue: boolean) => {
    const t = groupTotals(rows);
    const colour = revenue ? "#15803D" : "#B91C1C";
    return (
      <tr className="bg-[#FAFBFC]">
        <td className="border-b border-[#EAECEF] py-2 pl-3 pr-3 font-semibold">
          <span
            className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.07em]"
            style={{ color: colour }}
          >
            <span
              className="h-2 w-2 rounded-[2px]"
              style={{ background: colour }}
              aria-hidden="true"
            />
            {label}{" "}
            <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
              {rows.length} item{rows.length === 1 ? "" : "s"}
            </span>
          </span>
        </td>
        <td className="border-b border-[#EAECEF]" />
        <Num value={t.revenue} group />
        <Num value={t.profit} group />
        <Num value={afterTax(t.profit)} group />
        <td className="border-b border-[#EAECEF]" />
      </tr>
    );
  };

  const tableTotals = groupTotals(appliedRows);




  return (
    <div>
      <Block
        label="Earnings adjustments"
        hint="what revenue and profit would be under a new controlling owner"
        right="per year · THB"
      >
        {/* Stake */}
        <div className="mb-3.5 flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="text-[11.5px] text-muted-foreground">Valuing a</span>
          <span className="inline-flex overflow-hidden rounded-[7px] border border-[#D3D9E2]">
            {(["minority", "controlling"] as Stake[]).map((s, i) => (
              <button
                key={s}
                type="button"
                disabled={!canEdit || settingsMut.isPending}
                onClick={() => settingsMut.mutate({ stake: s })}
                className={`px-[13px] py-[5px] text-[12px] ${i ? "border-l border-[#D3D9E2]" : ""} ${
                  settings.stake === s ? "bg-[#1E3A8A] font-semibold text-white" : "bg-white"
                }`}
              >
                {s === "minority" ? "Minority stake" : "Controlling stake"}
              </button>
            ))}
          </span>
          <span className="text-[11.5px] text-muted-foreground">
            Adjustments apply only with control — a minority buyer can&apos;t change how the
            company spends.
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            Tax rate
            <input
              type="number"
              defaultValue={settings.taxRate}
              disabled={!canEdit}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v !== settings.taxRate) settingsMut.mutate({ taxRate: v });
              }}
              className="w-[52px] rounded-[6px] border border-[#C7D3E6] px-1.5 py-[2px] text-right tabular-nums text-[#0F1B33] outline-none"
              aria-label="tax rate percent"
            />
            %
          </span>
        </div>

        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {[
                "Adjustment",
                "Direction",
                "Type",
                "Filing line",
                "Revenue",
                "Profit, pre-tax",
                "Recurs",
                "",
              ].map((h, i) => (
                <th
                  key={h + i}
                  className={`whitespace-nowrap border-b border-[#EAECEF] pb-1.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                    i === 4 || i === 5 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {revenueRows.length > 0 && groupHead("Revenue", true)}
            {revenueRows.map(row)}
            {expenseRows.length > 0 && groupHead("Expenses", false)}
            {expenseRows.map(row)}

            <tr className="font-semibold">
              <td className="border-t border-[#EAECEF] py-2 pr-2 text-[#0F1B33]">Applied</td>
              <td className="border-t border-[#EAECEF]" />
              <td className="border-t border-[#EAECEF]" />
              <td className="border-t border-[#EAECEF]" />
              <td
                className={`whitespace-nowrap border-t border-[#EAECEF] py-2 pr-2 text-right tabular-nums ${
                  n.revenueAdjustment < 0 ? "text-[#B45309]" : "text-[#0F1B33]"
                }`}
              >
                {n.revenueAdjustment === 0
                  ? "—"
                  : `${n.revenueAdjustment > 0 ? "+ " : "− "}${thb(Math.abs(n.revenueAdjustment))}`}
              </td>
              <td
                className={`whitespace-nowrap border-t border-[#EAECEF] py-2 pr-2 text-right tabular-nums ${
                  n.netPreTax < 0 ? "text-[#B45309]" : "text-[#0F1B33]"
                }`}
              >
                {n.netPreTax >= 0 ? "+ " : "− "}
                {thb(Math.abs(n.netPreTax))}
              </td>
              <td className="border-t border-[#EAECEF]" />
              <td className="whitespace-nowrap border-t border-[#EAECEF] py-2 text-right font-normal text-muted-foreground">
                {n.appliedCount} applied · {n.savedCount} saved
              </td>
            </tr>
          </tbody>
        </table>

        {canEdit && (
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={(ev) => {
                openerRef.current = ev.currentTarget;
                setError(null);
                setDraft({ ...emptyRevenueDraft });
              }}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[#CFE8D8] bg-white px-3 text-[12.5px] font-semibold text-[#15803D] hover:bg-[#EFF7F2]"
            >
              ＋ Revenue adjustment
            </button>
            <button
              type="button"
              onClick={(ev) => {
                openerRef.current = ev.currentTarget;
                setError(null);
                setDraft({ ...emptyExpenseDraft });
              }}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[#F5D2D2] bg-white px-3 text-[12.5px] font-semibold text-[#B91C1C] hover:bg-[#FDF1F1]"
            >
              ＋ Expense adjustment
            </button>
          </div>
        )}


        {/* Checks */}
        <div className="mt-3 grid gap-1.5 border-t border-[#F2F4F6] pt-2.5 text-[12px]">
          <Check
            ok={overLine.length === 0}
            text={
              overLine.length === 0
                ? "Every applied expense adjustment is within its filing line."
                : `${overLine.length} adjustment${
                    overLine.length === 1 ? "" : "s"
                  } exceed their filing line.`
            }
          />
          <Check
            ok={revenueShare === null || revenueShare <= 10}
            text={
              revenueShare === null
                ? "No revenue adjustment applied."
                : revenueShare <= 10
                  ? `Revenue adjustments are ${revenueShare.toFixed(0)}% of reported revenue — below the 10% warning level.`
                  : `Revenue adjustments are ${revenueShare.toFixed(0)}% of reported revenue — beyond this, the valuation describes a different business from the one that filed the accounts.`
            }
          />
          <Check
            ok={bigShare === null || bigShare <= 50}
            text={
              bigShare === null
                ? "Reported profit before tax is not captured, so the 50% check cannot run."
                : bigShare <= 50
                  ? `Applied adjustments are ${bigShare.toFixed(0)}% of reported profit before tax — below the 50% warning level.`
                  : `Applied adjustments are ${bigShare.toFixed(0)}% of reported profit before tax — the valuation now depends more on adjustments than on the filing.`
            }
          />
          {n.unrecordedCount > 0 && (
            <Check
              ok={false}
              text={`${n.unrecordedCount} unrecorded item${
                n.unrecordedCount === 1 ? " is" : "s are"
              } listed and excluded.`}
            />
          )}
        </div>
      </Block>

      <Block label="Normalised figures" hint="reported, then adjusted">
        <div className="grid gap-2.5 md:grid-cols-2">
          <Card
            title="Revenue"
            reported={reportedRevenue}
            normalised={n.applied ? n.normalisedRevenue : reportedRevenue}
            delta={n.revenueAdjustment}
            foot={
              n.applied && n.revenueAdjustment !== 0
                ? "used by the revenue multiple"
                : "not adjusted"
            }
          />
          <Card
            title="Net profit"
            reported={reportedNetProfit}
            normalised={n.applied ? n.normalisedNetProfit : reportedNetProfit}
            delta={n.netEffect}
            foot={n.applied ? "used by the P/E method" : "not applied — minority stake"}
          />
        </div>
        <table className="mt-2.5 w-full border-collapse text-[12.5px]">
          <tbody>
            {[
              ["Revenue adjustment", n.revenueAdjustment, n.revenueAdjustment < 0],
              ["Add-backs to profit", n.addBacks, false],
              ["Deductions from profit", -n.deductions, true],
              ["Net adjustment, pre-tax", n.netPreTax, n.netPreTax < 0],
              [`Tax at ${settings.taxRate}%`, -n.tax, n.tax > 0],
              ["Net profit effect", n.netEffect, n.netEffect < 0],
            ].map(([label, value, neg], i, arr) => (
              <tr key={label as string}>
                <td
                  className={`py-[5px] ${
                    i === arr.length - 1
                      ? "font-semibold text-[#1E3A8A]"
                      : "border-b border-[#F2F4F6] text-[#0F1B33]"
                  }`}
                >
                  {label as string}
                </td>
                <td
                  className={`py-[5px] text-right tabular-nums ${
                    i === arr.length - 1
                      ? "font-semibold text-[#1E3A8A]"
                      : `border-b border-[#F2F4F6] ${neg ? "text-[#B45309]" : "text-[#0F1B33]"}`
                  }`}
                >
                  {(value as number) < 0 ? "− " : "+ "}
                  {fmtMoney(Math.abs(value as number))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block label="Effect on methods" hint="which ranges moved">
        <table className="w-full border-collapse text-[12.5px]">
          <tbody>
            <tr>
              <td className="border-b border-[#F2F4F6] py-[7px] text-[#0F1B33]">P/E</td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-muted-foreground">
                {n.applied
                  ? `${fmtMoney(reportedNetProfit)} → ${fmtMoney(n.normalisedNetProfit)} net profit`
                  : "reported net profit"}
              </td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-right tabular-nums">
                {peMoved ? (
                  n.applied ? (
                    <>
                      <span className="text-muted-foreground">
                        {fmtMoney(peBase!.low)} – {fmtMoney(peBase!.high)}
                      </span>{" "}
                      →{" "}
                      <b className="font-semibold text-[#0F1B33]">
                        {fmtMoney(peAdj!.low)} – {fmtMoney(peAdj!.high)}
                      </b>
                    </>
                  ) : (
                    <span className="text-[#0F1B33]">
                      {fmtMoney(peBase!.low)} – {fmtMoney(peBase!.high)}
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">not available</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border-b border-[#F2F4F6] py-[7px] text-[#0F1B33]">
                Revenue multiple
              </td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-muted-foreground">
                {n.applied && n.revenueAdjustment !== 0
                  ? `${fmtMoney(reportedRevenue)} → ${fmtMoney(n.normalisedRevenue)} revenue`
                  : "revenue unchanged"}
              </td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-right tabular-nums">
                {revMoved ? (
                  n.applied && n.revenueAdjustment !== 0 ? (
                    <>
                      <span className="text-muted-foreground">
                        {fmtMoney(revBase!.low)} – {fmtMoney(revBase!.high)}
                      </span>{" "}
                      →{" "}
                      <b className="font-semibold text-[#0F1B33]">
                        {fmtMoney(revAdj!.low)} – {fmtMoney(revAdj!.high)}
                      </b>
                    </>
                  ) : (
                    <span className="text-muted-foreground">no change</span>
                  )
                ) : (
                  <span className="text-muted-foreground">not available</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border-b border-[#F2F4F6] py-[7px] text-[#0F1B33]">P/BV</td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-muted-foreground">
                equity unchanged
              </td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-right text-muted-foreground">
                no change
              </td>
            </tr>
            {n.applied && peMoved && (
              <tr>
                <td className="py-[7px] font-semibold text-[#15803D]">P/E difference</td>
                <td />
                <td className="py-[7px] text-right font-semibold tabular-nums text-[#15803D]">
                  {peAdj!.low! - peBase!.low! >= 0 ? "+ " : "− "}
                  {fmtMoney(Math.abs(peAdj!.low! - peBase!.low!))} –{" "}
                  {fmtMoney(Math.abs(peAdj!.high! - peBase!.high!))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {n.normalisedNetProfit !== null && n.applied && n.normalisedNetProfit <= 0 && (
          <p className="mt-2 text-[11.5px] text-[#B45309]">
            Normalised profit is not positive, so P/E is suppressed as for any loss-making company.
          </p>
        )}
      </Block>

      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
            setError(null);
            openerRef.current?.focus();
          }
        }}
      >
        <DialogContent className="w-[440px] max-w-[92vw] gap-0 p-0">{dialogBody()}</DialogContent>
      </Dialog>
    </div>
  );

  function dialogBody() {
    if (!draft) return null;
    const revenue = isRevenueGroup(draft.type);
    const accent = revenue ? "#15803D" : "#B91C1C";
    const dir = direction(draft.type);
    const preview = effects(draftAdjustment(draft));
    const typeOptions = revenue ? DIALOG_REVENUE_TYPES : DIALOG_EXPENSE_TYPES;
    const taxed = (v: number) => v * (1 - settings.taxRate / 100);
    const amount = Number(draft.amount) || 0;
    const revenueAddBack =
      draft.type === "below_market_related_party" || draft.type === "revenue_elsewhere";
    const blocking = blockingCheck(draft);

    const money = (v: number, sign = true) =>
      `${sign ? (v >= 0 ? "+ " : "− ") : ""}${thb(Math.abs(v))}`;

    const boxes: { label: string; value: string; tone?: string }[] =
      draft.type === "unrecorded_income"
        ? []
        : draft.type === "below_market_related_party"
          ? [
              {
                label: "Market value",
                value: thb(amount + preview.revenue),
              },
              { label: "Revenue", value: money(preview.revenue) },
              { label: "Profit, after tax", value: money(taxed(preview.profit)) },
            ]
          : draft.type === "revenue_elsewhere"
            ? [
                { label: "Revenue", value: money(preview.revenue) },
                { label: "Profit, pre-tax", value: money(preview.profit) },
                { label: "Profit, after tax", value: money(taxed(preview.profit)) },
              ]
            : [
                { label: "Revenue", value: "no change", tone: "muted" },
                { label: "Profit, pre-tax", value: money(preview.profit) },
                { label: "Profit, after tax", value: money(taxed(preview.profit)) },
              ];

    // Live checks, in order: blocking first, then the amber notes.
    const notes: { text: string; tone: "red" | "amber" | "ok" }[] = [];
    const touched = draft.description.trim() !== "" || draft.amount.trim() !== "";
    if (blocking && touched) notes.push({ text: blocking, tone: "red" });
    if (
      !blocking &&
      dir === "add_back" &&
      !isRevenueType(draft.type) &&
      draft.filingLine &&
      filingLines[draft.filingLine] !== null
    )
      notes.push({
        text: `Within its filing line — ${thb(amount)} of ${m(filingLines[draft.filingLine]!)} on ${
          FILING_LINE_LABELS[draft.filingLine]
        }`,
        tone: "ok",
      });
    if (draft.type === "revenue_elsewhere" && draft.costsAmount.trim() === "")
      notes.push({
        text: "No costs entered — the full amount is treated as profit. Correct only if these sales carry no cost.",
        tone: "amber",
      });
    if (reportedRevenue && Math.abs(preview.revenue) > reportedRevenue * 0.1)
      notes.push({
        text: "This is more than 10% of reported revenue — beyond this, the valuation describes a different business from the one that filed the accounts.",
        tone: "amber",
      });
    if (profitBeforeTax && profitBeforeTax > 0 && Math.abs(preview.profit) > profitBeforeTax * 0.5)
      notes.push({
        text: "This is more than 50% of reported profit before tax.",
        tone: "amber",
      });

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-2 border-b border-[#EAECEF] px-4 py-3">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <DialogTitle className="m-0 text-[13.5px] font-semibold text-[#0F1B33]">
            {draft.id
              ? "Edit adjustment"
              : revenue
                ? "Add revenue adjustment"
                : "Add expense adjustment"}
          </DialogTitle>
        </div>

        <div className="grid gap-2.5 px-4 py-3.5">
          <Field label="Type">
            <select
              className={inputClass}
              value={draft.type}
              onChange={(e) => {
                const type = e.target.value as AdjustmentType;
                setDraft({
                  ...draft,
                  type,
                  filingLine: isRevenueType(type)
                    ? type === "one_off_income"
                      ? "other_income"
                      : "revenue"
                    : type === "unrecorded_income"
                      ? null
                      : (draft.filingLine ?? "selling_admin"),
                  recurs:
                    type === "below_market_related_party" || type === "revenue_elsewhere"
                      ? "yearly"
                      : type === "one_off_income"
                        ? "one_off"
                        : draft.recurs,
                });
                setError(null);
              }}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {ADJUSTMENT_TYPE_LABELS[t]} — {DIR_LABEL[direction(t)]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <input
              autoFocus
              className={inputClass}
              placeholder="What is being adjusted"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field
              label={
                draft.type === "below_market_related_party"
                  ? "Sales at the related price"
                  : draft.type === "revenue_elsewhere"
                    ? "Sales"
                    : draft.type === "one_off_income" || draft.type === "unrecorded_income"
                      ? "Amount"
                      : "Amount per year"
              }
            >
              <Unit unit="THB">
                <input
                  className={`${inputClass} pr-10 text-right tabular-nums`}
                  inputMode="numeric"
                  placeholder="e.g. 5,000,000"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: e.target.value.replace(/,/g, "") })
                  }
                />
              </Unit>
            </Field>

            {draft.type === "below_market_related_party" && (
              <Field label="Discount to market">
                <Unit unit="%">
                  <input
                    className={`${inputClass} pr-8 text-right tabular-nums`}
                    inputMode="numeric"
                    placeholder="e.g. 20"
                    value={draft.discountPct}
                    onChange={(e) => setDraft({ ...draft, discountPct: e.target.value })}
                  />
                </Unit>
              </Field>
            )}

            {draft.type === "revenue_elsewhere" && (
              <Field label="Costs of those sales">
                <Unit unit="THB">
                  <input
                    className={`${inputClass} pr-10 text-right tabular-nums`}
                    inputMode="numeric"
                    placeholder="e.g. 2,400,000"
                    value={draft.costsAmount}
                    onChange={(e) =>
                      setDraft({ ...draft, costsAmount: e.target.value.replace(/,/g, "") })
                    }
                  />
                </Unit>
              </Field>
            )}

            {!revenue && (
              <Field label="Filing line">
                <select
                  className={inputClass}
                  value={draft.filingLine ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      filingLine: (e.target.value || null) as FilingLine | null,
                    })
                  }
                >
                  <option value="">—</option>
                  {LINES.map((l) => (
                    <option key={l} value={l}>
                      {FILING_LINE_LABELS[l]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Recurs">
            <div className="inline-flex overflow-hidden rounded-[7px] border border-[#D3D9E2]">
              {(["yearly", "one_off"] as Recurs[]).map((r, i) => {
                const disabled =
                  (revenueAddBack && r === "one_off") ||
                  (draft.type === "one_off_income" && r === "yearly");
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDraft({ ...draft, recurs: r })}
                    className={`px-3 py-[5px] text-[12px] ${i ? "border-l border-[#D3D9E2]" : ""} ${
                      draft.recurs === r
                        ? "bg-[#1E3A8A] font-semibold text-white"
                        : disabled
                          ? "bg-white text-[#A5ADB8]"
                          : "bg-white text-[#0F1B33]"
                    }`}
                  >
                    {r === "yearly" ? "Yearly" : "One-off"}
                  </button>
                );
              })}
            </div>
          </Field>
          {revenueAddBack && (
            <p className="m-0 text-[11px] text-muted-foreground">
              Revenue add-backs must recur. A one-off gain is recorded as One-off income, which is
              deducted.
            </p>
          )}

          {draft.type === "unrecorded_income" ? (
            <div className="rounded-[7px] border border-[#EAECEF] bg-[#FAFBFC] px-3 py-2 text-[12px] text-muted-foreground">
              Recorded only — never applied
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {boxes.map((b) => (
                <div
                  key={b.label}
                  className="rounded-[7px] border border-[#DDE3F2] bg-[#F5F7FD] px-2.5 py-2"
                >
                  <div className="text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    {b.label}
                  </div>
                  <div
                    className={`mt-0.5 text-[13px] font-semibold tabular-nums ${
                      b.tone === "muted" ? "text-muted-foreground" : "text-[#1E3A8A]"
                    }`}
                  >
                    {b.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {notes.map((nt) => (
            <p
              key={nt.text}
              className={`m-0 text-[11.5px] ${
                nt.tone === "red"
                  ? "text-[#B91C1C]"
                  : nt.tone === "amber"
                    ? "text-[#B45309]"
                    : "text-[#15803D]"
              }`}
            >
              {nt.tone === "ok" ? "✓ " : nt.tone === "amber" ? "⚠ " : ""}
              {nt.text}
            </p>
          ))}
          {error && <p className="m-0 text-[11.5px] text-[#B91C1C]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EAECEF] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setError(null);
              openerRef.current?.focus();
            }}
            className="h-[30px] rounded-[7px] border border-[#EAECEF] bg-white px-3 text-[12.5px] font-semibold text-[#0F1B33]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!!blocking || saveMut.isPending}
            style={{ background: blocking ? "#B8BEC8" : accent }}
            className="h-[30px] rounded-[7px] px-3 text-[12.5px] font-semibold text-white"
          >
            {draft.id ? "Save changes" : "Add adjustment"}
          </button>
        </div>
      </form>
    );
  }
}

function Unit({ unit, children }: { unit: string; children: React.ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10.5px] text-muted-foreground">
        {unit}
      </span>
    </span>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[2px]">
      <span className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Effect({ value }: { value: number | null }) {
  const none = value === null || value === 0;
  return (
    <td
      className={`border-b border-[#F2F4F6] py-2 pr-2 text-right tabular-nums ${
        none ? "text-[#A5ADB8]" : value! < 0 ? "text-[#B45309]" : "text-[#0F1B33]"
      }`}
    >
      {none ? "—" : `${value! > 0 ? "+ " : "− "}${thb(Math.abs(value!))}`}
    </td>
  );
}

function Card({
  title,
  reported,
  normalised,
  delta,
  foot,
}: {
  title: string;
  reported: number | null;
  normalised: number | null;
  delta: number;
  foot: string;
}) {
  const moved = delta !== 0 && reported !== null && normalised !== null && reported !== normalised;
  return (
    <div className="rounded-[7px] border border-[#DDE3F2] bg-[#F5F7FD] px-3 py-2.5">
      <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </div>
      <div className="flex items-baseline gap-2">
        {moved && (
          <span className="text-[13px] tabular-nums text-muted-foreground line-through">
            {fmtMoney(reported)}
          </span>
        )}
        <span className="text-[19px] font-semibold tabular-nums text-[#1E3A8A]">
          {fmtMoney(normalised)}
        </span>
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Pill({ kind }: { kind: "add_back" | "deduct" | "none" }) {
  const map = {
    add_back: ["add back", "border-[#CFE8D8] bg-[#EFF7F2] text-[#15803D]"],
    deduct: ["deduct", "border-[#F2DFC8] bg-[#FDF3EC] text-[#B45309]"],
    none: ["—", "border-[#EAECEF] bg-[#F3F4F6] text-[#6B7280]"],
  } as const;
  const [label, cls] = map[kind];
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-[1px] text-[10.5px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-baseline gap-2 ${ok ? "" : "text-[#7C4A0B]"}`}>
      <i className={`w-[14px] text-center font-bold not-italic ${ok ? "text-[#15803D]" : "text-[#B45309]"}`}>
        {ok ? "✓" : "!"}
      </i>
      <span>{text}</span>
    </div>
  );
}
