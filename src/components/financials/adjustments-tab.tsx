/**
 * Valuation → Adjustments. Earnings normalisation: the owner's personal costs
 * added back, unpaid roles deducted, unrecorded income recorded but never used.
 * Adjustments apply only when a controlling stake is being valued.
 */
import { useState } from "react";
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
  normalise,
  type Adjustment,
  type AdjustmentType,
  type FilingLine,
  type Recurs,
  type Stake,
  type ValuationSettings,
} from "@/lib/valuation-adjustments";
import { fmtMoney, type ValuationResult } from "@/lib/valuation";

const TYPES: AdjustmentType[] = [
  "booked_expense",
  "one_off_expense",
  "missing_cost",
  "unrecorded_income",
];
const LINES: FilingLine[] = ["cost_of_goods_sold", "selling_admin", "other_expenses"];

const thb = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

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
  recurs: Recurs;
}

const emptyDraft: Draft = {
  description: "",
  type: "booked_expense",
  filingLine: "selling_admin",
  amount: "",
  recurs: "yearly",
};

const inputClass =
  "h-[30px] w-full rounded-[6px] border border-[#C7D3E6] bg-white px-2 text-[12.5px] text-[#0F1B33] outline-none focus:border-[#1E3A8A]";

export function AdjustmentsTab({
  startupId,
  year,
  canEdit,
  adjustments,
  settings,
  filingLines,
  profitBeforeTax,
  reportedNetProfit,
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
          recurs: d.recurs,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      setError(null);
      await invalidate();
      toast.success("Adjustment saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeAdj({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Adjustment removed");
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove"),
  });

  const n = normalise(adjustments, settings, reportedNetProfit);
  const controlling = settings.stake === "controlling";

  /** An add-back can never be larger than the line it sits on. */
  const lineCheck = (d: Draft): string | null => {
    if (direction(d.type) !== "add_back" || !d.filingLine) return null;
    const cap = filingLines[d.filingLine];
    const amount = Number(d.amount) || 0;
    if (cap === null || amount <= cap) return null;
    return `${thb(amount)} is more than the ${thb(cap)} on ${FILING_LINE_LABELS[d.filingLine]}.`;
  };

  const overLine = adjustments.filter((a) => {
    if (direction(a.type) !== "add_back" || !a.filingLine) return false;
    const cap = filingLines[a.filingLine];
    return cap !== null && a.amount > cap;
  });

  const netApplied = Math.abs(n.netPreTax);
  const bigShare =
    controlling && profitBeforeTax !== null && profitBeforeTax > 0
      ? (netApplied / profitBeforeTax) * 100
      : null;

  const submit = () => {
    if (!draft) return;
    if (!draft.description.trim()) {
      setError("A description is required.");
      return;
    }
    const msg = lineCheck(draft);
    if (msg) {
      setError(msg);
      return;
    }
    saveMut.mutate(draft);
  };

  const peBase = baseResult.methods.find((m) => m.key === "pe");
  const peAdj = adjustedResult.methods.find((m) => m.key === "pe");
  const peMoved =
    peBase?.low != null && peBase.high != null && peAdj?.low != null && peAdj.high != null;

  if (!year) {
    return (
      <p className="text-[12.5px] text-muted-foreground">
        Adjustments need a fiscal year of filed figures.
      </p>
    );
  }

  return (
    <div>
      <Block
        label="Earnings adjustments"
        hint="what profit would be under a new controlling owner"
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
              {["Adjustment", "Direction", "Type", "Filing line", "Pre-tax / yr", "Recurs", ""].map(
                (h, i) => (
                  <th
                    key={h + i}
                    className={`whitespace-nowrap border-b border-[#EAECEF] pb-1.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground ${
                      i === 4 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => {
              const d = direction(a.type);
              const none = d === "none";
              if (draft?.id === a.id) return <Fragment key={a.id}>{DraftRow()}</Fragment>;
              return (
                <tr key={a.id} className={none ? "text-[#A5ADB8]" : undefined}>
                  <td
                    className={`border-b border-[#F2F4F6] py-2 pr-2 font-medium ${
                      none ? "text-[#A5ADB8]" : "text-[#0F1B33]"
                    }`}
                  >
                    {a.description}
                  </td>
                  <td className="border-b border-[#F2F4F6] py-2 pr-2">
                    <Pill kind={d} />
                  </td>
                  <td className="border-b border-[#F2F4F6] py-2 pr-2 text-muted-foreground">
                    {ADJUSTMENT_TYPE_LABELS[a.type]}
                  </td>
                  <td className="border-b border-[#F2F4F6] py-2 pr-2 text-muted-foreground">
                    {a.filingLine ? FILING_LINE_LABELS[a.filingLine] : "—"}
                  </td>
                  <td
                    className={`border-b border-[#F2F4F6] py-2 pr-2 text-right tabular-nums ${
                      d === "deduct" ? "text-[#B45309]" : none ? "text-[#A5ADB8]" : "text-[#0F1B33]"
                    }`}
                  >
                    {none ? "" : d === "add_back" ? "+ " : "− "}
                    {thb(a.amount)}
                  </td>
                  <td className="border-b border-[#F2F4F6] py-2 pr-2">
                    <span className="rounded-full border border-[#EAECEF] bg-[#F3F4F6] px-2 py-[1px] text-[10.5px] font-semibold text-[#6B7280]">
                      {a.recurs === "yearly" ? "yearly" : "one-off"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-[#F2F4F6] py-2 text-right">
                    {none && (
                      <span className="mr-2 text-[11px] font-medium text-[#B91C1C]">
                        recorded, never applied — not verifiable from the filing
                      </span>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          aria-label="Edit adjustment"
                          onClick={() => {
                            setError(null);
                            setDraft({
                              id: a.id,
                              description: a.description,
                              type: a.type,
                              filingLine: a.filingLine,
                              amount: String(a.amount),
                              recurs: a.recurs,
                            });
                          }}
                          className="px-1 text-muted-foreground"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label="Delete adjustment"
                          onClick={() => deleteMut.mutate(a.id)}
                          className="px-1 text-muted-foreground"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}

            {draft && !draft.id && DraftRow()}

            <tr className="font-semibold">
              <td className="border-t border-[#EAECEF] py-2 pr-2 text-[#0F1B33]">Applied</td>
              <td className="border-t border-[#EAECEF]" />
              <td className="border-t border-[#EAECEF]" />
              <td className="border-t border-[#EAECEF]" />
              <td
                className={`border-t border-[#EAECEF] py-2 pr-2 text-right tabular-nums ${
                  n.netPreTax < 0 ? "text-[#B45309]" : "text-[#0F1B33]"
                }`}
              >
                {n.netPreTax >= 0 ? "+ " : "− "}
                {thb(Math.abs(n.netPreTax))}
              </td>
              <td className="border-t border-[#EAECEF]" />
              <td className="border-t border-[#EAECEF] py-2 text-right font-normal text-muted-foreground">
                {n.appliedCount} of {n.savedCount} saved
              </td>
            </tr>
          </tbody>
        </table>

        {canEdit && !draft && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDraft({ ...emptyDraft });
            }}
            className="mt-2 text-[12px] font-semibold text-[#1E3A8A]"
          >
            ＋ Add adjustment
          </button>
        )}

        {/* Checks */}
        <div className="mt-3 grid gap-1.5 border-t border-[#F2F4F6] pt-2.5 text-[12px]">
          <Check
            ok={overLine.length === 0}
            text={
              overLine.length === 0
                ? "Every applied adjustment is within its filing line."
                : `${overLine.length} adjustment${
                    overLine.length === 1 ? "" : "s"
                  } exceed their filing line.`
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

      <Block label="Normalised profit" hint="reported, then adjusted">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5">
          <div className="rounded-[7px] border border-[#EAECEF] px-3 py-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              Reported net profit
            </div>
            <div className="text-[19px] font-semibold tabular-nums text-[#0F1B33]">
              {fmtMoney(reportedNetProfit)}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">FY{year} filing</div>
          </div>
          <div className="flex items-center whitespace-nowrap text-[12px] font-semibold text-[#1E3A8A]">
            {n.netEffect >= 0 ? "+ " : "− "}
            {fmtMoney(Math.abs(n.netEffect))} →
          </div>
          <div className="rounded-[7px] border border-[#DDE3F2] bg-[#F5F7FD] px-3 py-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              Normalised net profit
            </div>
            <div className="text-[19px] font-semibold tabular-nums text-[#1E3A8A]">
              {fmtMoney(n.normalisedNetProfit)}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {n.applied ? "used by the P/E method" : "not applied — minority stake"}
            </div>
          </div>
        </div>
        <table className="mt-2.5 w-full border-collapse text-[12.5px]">
          <tbody>
            {[
              ["Add-backs", n.addBacks, false],
              ["Deductions", -n.deductions, true],
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
                revenue unchanged
              </td>
              <td className="border-b border-[#F2F4F6] py-[7px] text-right text-muted-foreground">
                no change
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
    </div>
  );

  function DraftRow() {
    if (!draft) return null;
    const dir = direction(draft.type);
    return (
      <>
        <tr>
          <td colSpan={7} className="bg-[#F7FAFF] p-0">
            <div className="grid grid-cols-[1.6fr_0.9fr_1.1fr_1.1fr_0.9fr_0.8fr] gap-2 px-1 py-2.5">
              <input
                className={inputClass}
                placeholder="What is being adjusted"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <div className="flex h-[30px] items-center rounded-[6px] border border-dashed border-[#C7D3E6] bg-white px-2 text-[12px] text-muted-foreground">
                {dir === "add_back" ? "Add back" : dir === "deduct" ? "Deduct" : "Never applied"}
              </div>
              <select
                className={inputClass}
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as AdjustmentType })
                }
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ADJUSTMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                disabled={draft.type === "unrecorded_income"}
                value={draft.filingLine ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, filingLine: (e.target.value || null) as FilingLine | null })
                }
              >
                <option value="">—</option>
                {LINES.map((l) => (
                  <option key={l} value={l}>
                    {FILING_LINE_LABELS[l]}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} text-right tabular-nums`}
                inputMode="numeric"
                placeholder="0"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
              <select
                className={inputClass}
                value={draft.recurs}
                onChange={(e) => setDraft({ ...draft, recurs: e.target.value as Recurs })}
              >
                <option value="yearly">Yearly</option>
                <option value="one_off">One-off</option>
              </select>
            </div>
            <div className="flex items-center gap-2.5 px-1 pb-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={saveMut.isPending}
                className="h-[30px] rounded-[7px] bg-[#1E3A8A] px-[13px] text-[12px] font-semibold text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setError(null);
                }}
                className="h-[30px] rounded-[7px] border border-[#EAECEF] bg-white px-[13px] text-[12px] font-semibold text-[#0F1B33]"
              >
                Cancel
              </button>
              {error && <span className="text-[11.5px] text-[#B91C1C]">{error}</span>}
            </div>
          </td>
        </tr>
      </>
    );
  }
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
