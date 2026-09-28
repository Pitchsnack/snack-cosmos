import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markReportGenerated, publishReport } from "@/lib/report-orders.functions";
import { cn } from "@/lib/utils";
import { dayMonth, dayMonthTime, useStartupReportOrders, type ReportOrder } from "./report-order-bits";

/** One strip above the Financials / Valuation tab body: Paid · Generated · Published. */
export function ReportOrderStrip({
  startupId, kind, regNo, onGenerate, onEdit,
}: {
  startupId: string;
  kind: "financials" | "valuation";
  regNo?: string | null;
  /** Runs the DBD extraction; resolves with the fiscal years filled, or null on failure. */
  onGenerate?: () => Promise<number[] | null>;
  onEdit?: () => void;
}) {
  const { data } = useStartupReportOrders(startupId);
  const orders = (data?.orders ?? []) as ReportOrder[];
  const o = orders.find((x) => x.kind === kind || x.kind === "bundle");
  const finDelivered = orders.some((x) => (x.kind === "financials" || x.kind === "bundle") && x.status === "delivered");
  const names = data?.names ?? {};
  const qc = useQueryClient();
  const genFn = useServerFn(markReportGenerated);
  const pubFn = useServerFn(publishReport);
  const [running, setRunning] = useState(false);
  const [details, setDetails] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["report-orders"] }); qc.invalidateQueries({ queryKey: ["approvals"] }); };

  const publish = useMutation({
    mutationFn: () => pubFn({ data: { orderId: o!.id } }),
    onSuccess: () => { refresh(); toast.success("Published to the seller"); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!o) return null;
  const step = o.status === "delivered" ? 3 : o.status === "generated" ? 2 : 1;
  const blocked = kind === "valuation" && !finDelivered;

  const generate = async () => {
    setRunning(true);
    try {
      const years = onGenerate ? await onGenerate() : [];
      if (years === null) return;
      await genFn({ data: { orderId: o.id, years, regNo: regNo ?? null } });
      refresh();
      toast.success("Report generated — review, then Verify & publish");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const title = running ? "Generating from DBD…" : step === 3 ? `Published to seller · ${dayMonthTime(o.delivered_at)}`
    : step === 2 ? "Generated · draft, not visible to the seller" : kind === "valuation" ? "Estimated valuation" : "Verified financial report";

  return (
    <div className="mb-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13.5px] font-bold">
            {title}
            {step === 1 && !running && <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10.5px] font-bold text-[#1D4ED8]">Paid</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            Order {o.ref} · paid {dayMonth(o.paid_at)} · due {dayMonth(o.due_at)} ·{" "}
            <button type="button" className="underline" onClick={() => setDetails((v) => !v)}>details</button>
          </div>
          {details && (
            <div className="mt-1 text-xs text-muted-foreground">
              {o.payment_ref ?? "—"} · invoice PDF {o.invoice_no ?? "not issued"} · seller {names[o.ordered_by ?? ""] ?? "—"} · source DBD e-Filing {regNo ?? "—"} · analyst {names[o.analyst_id ?? ""] ?? "—"}
            </div>
          )}
        </div>
        <div className="flex items-start gap-5">
          {["Paid", "Generated", "Published"].map((l, i) => {
            const done = i + 1 < step || (step === 3 && i === 2);
            const cur = i + 1 === step && step !== 3;
            return (
              <div key={l} className="flex flex-col items-center gap-1 text-[11px]">
                <span className={cn("h-3 w-3 rounded-full border-2", done ? "border-emerald-500 bg-emerald-500" : cur ? "border-amber-500 bg-amber-500" : "border-muted-foreground/40")} />
                <span className={cn(cur && "font-bold")}>{l}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          {step === 1 && (
            <button type="button" disabled={running || blocked} onClick={generate}
              title={blocked ? "Publish the financial report first" : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-sidebar px-3.5 py-2 text-[13px] font-semibold text-sidebar-foreground disabled:opacity-50">
              {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{running ? "Extracting DBD filings…" : "Generate from DBD"}
            </button>
          )}
          {step >= 2 && onEdit && (
            <button type="button" onClick={onEdit} className="rounded-lg border border-border bg-background px-3.5 py-2 text-[13px] font-semibold">Edit figures</button>
          )}
          {step === 2 && (
            <button type="button" disabled={publish.isPending} onClick={() => publish.mutate()}
              className="rounded-lg bg-sidebar px-3.5 py-2 text-[13px] font-semibold text-sidebar-foreground disabled:opacity-50">Verify & publish</button>
          )}
          {step === 3 && (
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-border bg-background px-3.5 py-2 text-[13px] font-semibold">Download PDF</button>
          )}
        </div>
      </div>
      {step === 1 && !running && (
        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
          No report yet. Generate from DBD pulls FY2021–2025 filings for {regNo ?? "the registration number"} and fills every section.
        </div>
      )}
    </div>
  );
}
