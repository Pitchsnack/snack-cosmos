import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStartupReportOrders, listReportOrders } from "@/lib/report-orders.functions";
import { cn } from "@/lib/utils";

export type ReportOrder = {
  id: string; ref: string; startup_id: string; kind: "financials" | "valuation" | "bundle"; amount: number; currency: string;
  status: "paid" | "generated" | "delivered" | "cancelled" | "refunded"; paid_at: string; due_at: string | null;
  payment_ref: string | null; method: string | null; ordered_by: string | null; generated_at: string | null;
  analyst_id: string | null; delivered_at: string | null; delivered_by: string | null; invoice_no: string | null;
  startups?: { id: string; startup_name: string; registered_number: string | null; hidden_profiles?: { code_name: string | null; ref_no: string | null }[] | { code_name: string | null; ref_no: string | null } | null };
};

export type OrderState = "paid" | "overdue" | "generated" | "delivered";
export function orderState(o: ReportOrder): OrderState {
  if (o.status === "delivered") return "delivered";
  if (o.status === "generated") return "generated";
  if (o.due_at && new Date(o.due_at).getTime() < Date.now()) return "overdue";
  return "paid";
}
export const overdueDays = (o: ReportOrder) => (o.due_at ? Math.max(1, Math.ceil((Date.now() - new Date(o.due_at).getTime()) / 86_400_000)) : 0);
export const dayMonth = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
export const dayMonthTime = (d?: string | null) =>
  d ? `${dayMonth(d)}, ${new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "—";
export const kindLabel = (k: string) => (k === "valuation" ? "Estimated valuation" : k === "bundle" ? "Financials + valuation" : "Financial report");
export const money = (o: ReportOrder) => `${o.currency === "THB" ? "฿" : o.currency + " "}${Number(o.amount).toLocaleString()}`;
export function hpOf(o: ReportOrder) {
  const h = o.startups?.hidden_profiles;
  return Array.isArray(h) ? h[0] : h ?? null;
}

export const TONE = {
  amber: "bg-[#FFFBEB] text-[#B45309] border-[#FCD34D]",
  red: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  green: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
} as const;

export function Pill({ tone, children, className }: { tone: keyof typeof TONE; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold", TONE[tone], className)}>{children}</span>;
}

export function OrderStatusPill({ o }: { o: ReportOrder }) {
  const s = orderState(o);
  return s === "overdue" ? <Pill tone="red">Overdue</Pill> : s === "generated" ? <Pill tone="violet">Generated · review</Pill>
    : s === "delivered" ? <Pill tone="green">Delivered</Pill> : <Pill tone="amber">Paid · not generated</Pill>;
}

/** Directory "Report:" chip text. */
export function ReportChip({ o }: { o: ReportOrder }) {
  const s = orderState(o);
  return s === "overdue" ? <Pill tone="red">฿ {kindLabel(o.kind)} · overdue</Pill>
    : s === "generated" ? <Pill tone="violet">Report generated · review</Pill>
    : s === "delivered" ? <Pill tone="green">Report delivered</Pill>
    : <Pill tone="amber">฿ {kindLabel(o.kind)} · paid {dayMonth(o.paid_at)}</Pill>;
}

export function useAllReportOrders(enabled = true) {
  const fn = useServerFn(listReportOrders);
  return useQuery({ queryKey: ["report-orders", "all"], queryFn: () => fn(), enabled, staleTime: 30_000 });
}
export function useStartupReportOrders(startupId: string | undefined) {
  const fn = useServerFn(getStartupReportOrders);
  return useQuery({
    queryKey: ["report-orders", "startup", startupId],
    queryFn: () => fn({ data: { startupId: startupId! } }),
    enabled: !!startupId,
  });
}
