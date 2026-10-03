import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectorArt } from "@/components/hidden-profile/bits";
import { assignApproval, listApprovals } from "@/lib/approvals.functions";
import { cn } from "@/lib/utils";
import { useAllReportOrders, type ReportOrder } from "@/components/reports/report-order-bits";
import { ApprovalsSplit, listingItems, profileItems, verificationItems } from "@/components/reports/approvals-split";
import { PaidReports, HistoryTab, Tile, isOverdue } from "@/components/reports/approvals-report-tabs";

export const Route = createFileRoute("/_authenticated/approvals/")({
  head: () => ({
    meta: [
      { title: "Approvals — Pitchsnack Admin" },
      { name: "description", content: "Review seller listings and buyer verifications waiting for Admin approval." },
    ],
  }),
  validateSearch: z.object({ tab: z.enum(["listings", "buyers", "reports", "history"]).optional() }),
  component: ApprovalsPage,
});

const days = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)) : 0);
const ago = (d?: string | null) => {
  if (!d) return "—";
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  return h < 24 ? `${h}h waiting` : `${Math.floor(h / 24)}d waiting`;
};
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const ACTION: Record<string, string> = {
  submit: "Submitted", resubmit: "Resubmitted", withdraw: "Withdrawn", approve: "Approved & published", request_changes: "Changes requested",
  reject: "Rejected", unpublish: "Unpublished", assign: "Assigned", verify: "Verified buyer", more_info: "More info requested", decline: "Declined",
};

function ApprovalsPage() {
  const s = Route.useSearch();
  const tab = s.tab ?? "listings";
  const navigate = Route.useNavigate();
  const fn = useServerFn(listApprovals);
  const assignFn = useServerFn(assignApproval);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["approvals", "list"], queryFn: () => fn() });
  const assign = useMutation({
    mutationFn: (v: { kind: "listing" | "buyer"; id: string }) => assignFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast.success("Assigned to you"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("oldest");

  const listings = useMemo(() => {
    let l = (data?.listings ?? []) as any[];
    if (status === "waiting") l = l.filter((x) => x.approval_status === "in_review" && !x.has_live);
    if (status === "edits") l = l.filter((x) => x.approval_status === "in_review" && x.has_live);
    if (status === "changes") l = l.filter((x) => x.approval_status === "changes_requested");
    if (type !== "all") l = l.filter((x) => typeOf(x) === type);
    if (q) l = l.filter((x) => `${x.code_name} ${x.ref_no} ${x.startups?.startup_name} ${data?.emails?.[x.submitted_by] ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    if (sort === "newest") l = [...l].reverse();
    if (sort === "mine") l = l.filter((x) => x.assignee_id === data?.me);
    return l;
  }, [data, status, type, q, sort]);
  const waitingOnSellers = (data?.listings ?? []).filter((x: any) => x.approval_status === "changes_requested").length;
  const buyers = ((data?.buyers ?? []) as any[]).filter((b) => (status === "waiting" ? b.status === "pending" : true))
    .filter((b) => !q || `${b.company_name} ${b.work_email}`.toLowerCase().includes(q.toLowerCase()));
  const oldest = Math.max(0, ...[...(data?.listings ?? []), ...(data?.buyers ?? [])].map((x: any) => days(x.submitted_at)));
  const names = (data?.names ?? {}) as Record<string, string>;
  const { data: od } = useAllReportOrders();
  const orders = (od?.orders ?? []) as ReportOrder[];
  const overdueOrders = orders.filter(isOverdue);
  const reportsWaiting = orders.filter((o) => o.status !== "delivered").length;
  const deliveredWeek = orders.filter((o) => o.delivered_at && Date.now() - +new Date(o.delivered_at) < 7 * 86_400_000).length;
  const listingsWaiting = (data?.listings ?? []).filter((x: any) => x.approval_status === "in_review").length;
  const profilesWaiting = (((data as any)?.profiles ?? []) as any[]).filter((p: any) => p.approval_status === "in_review").length;
  const buyersWaiting = (data?.buyers ?? []).filter((b: any) => b.status === "pending").length;

  return (
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Approvals &amp; alerts</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that needs an admin: {listingsWaiting} seller listings · {buyersWaiting + profilesWaiting} buyers · <b className="text-foreground">{reportsWaiting} paid reports</b> · {overdueOrders.length} overdue</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Alert settings are coming soon.")}>Alert settings</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["listings", "#F6A823", "Seller listings", listingsWaiting, `oldest ${oldest} day${oldest === 1 ? "" : "s"}`],
          ["buyers", "#4338CA", "Buyer profiles", profilesWaiting, "to publish"],
          ["buyers", "#6D28D9", "Buyer verifications", buyersWaiting, "pending"],
          ["reports", "#9CA3AF", "Paid reports", reportsWaiting, overdueOrders.length ? `${overdueOrders.length} overdue` : "seller asked"],
        ] as const).map(([k, c, label, n, sub]) => (
          <button key={label} type="button" onClick={() => navigate({ search: { tab: k } })}
            className="rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-[#CBD2DC]">
            <small className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><i className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />{label}</small>
            <b className="mt-0.5 block text-[22px] font-semibold">{n}</b>
            <span className="text-[11.5px] text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {([["listings", "Sellers", data?.listings.length ?? 0], ["buyers", "Buyers", (data?.buyers.length ?? 0) + profilesWaiting], ["reports", "Paid reports", reportsWaiting], ["history", "History", null]] as const).map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => navigate({ search: { tab: k } })}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold", tab === k ? "border-[#F6A823] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}{n !== null && <span className={cn("rounded-full px-[7px] py-px text-[10.5px] font-bold", tab === k ? "bg-[#FEF3DE] text-[#8A4B06]" : "bg-muted text-muted-foreground")}>{n}</span>}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : tab === "listings" ? (
        <ApprovalsSplit key="sellers" empty="No seller listings waiting."
          groups={[["Waiting for review", listingItems(((data?.listings ?? []) as any[]).filter((x) => x.approval_status === "in_review"), names, (data?.emails ?? {}) as Record<string, string>)]]} />
      ) : tab === "buyers" ? (
        <ApprovalsSplit key="buyers" empty="No buyers waiting."
          groups={[["Profiles to publish", profileItems(((data as any)?.profiles ?? []) as any[], names)], ["Buyer verifications", verificationItems(((data?.buyers ?? []) as any[]).filter((b) => b.status === "pending"), names)]]} />
      ) : tab === "reports" ? (
        <PaidReports orders={orders} />
      ) : (
        <HistoryTab approvalEvents={(data?.history ?? []) as any[]} startupInfo={(data as any)?.startupInfo ?? {}} buyerInfo={(data as any)?.buyerInfo ?? {}} names={names} />
      )}
    </div>
  );
}

function typeOf(l: any) { return /startup/i.test(l.startups?.company_type ?? "") ? "Startup" : "Business"; }
function QueueChip({ l }: { l: any }) {
  const [label, tone] = l.approval_status === "changes_requested" ? ["Changes requested", "bg-purple-500/15 text-purple-700"]
    : l.has_live ? ["Live · edits pending", "bg-blue-500/15 text-blue-700"] : ["In review", "bg-amber-500/15 text-amber-800"];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{label}</span>;
}
export function StatusPill({ s }: { s: string }) {
  const tone = /Changes|More info|Resubmitted/.test(s) ? "bg-amber-500/15 text-amber-800" : /Live|Verified|Approved/.test(s) ? "bg-emerald-500/15 text-emerald-700" : /Reject|Declin/.test(s) ? "bg-red-500/15 text-red-700" : "bg-blue-500/15 text-blue-700";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{s}</span>;
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="p-8 text-center text-muted-foreground">{text}</td></tr>;
}
