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

export const Route = createFileRoute("/_authenticated/approvals/")({
  head: () => ({
    meta: [
      { title: "Approvals — Pitchsnack Admin" },
      { name: "description", content: "Review seller listings and buyer verifications waiting for Admin approval." },
    ],
  }),
  validateSearch: z.object({ tab: z.enum(["listings", "buyers", "history"]).optional() }),
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
    if (status === "waiting") l = l.filter((x) => x.approval_status === "in_review" && x.status !== "live");
    if (status === "edits") l = l.filter((x) => x.approval_status === "in_review" && x.status === "live");
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
  const waiting = (data?.listings ?? []).filter((x: any) => x.approval_status === "in_review").length + (data?.buyers ?? []).filter((b: any) => b.status === "pending").length;
  const oldest = Math.max(0, ...[...(data?.listings ?? []), ...(data?.buyers ?? [])].map((x: any) => days(x.submitted_at)));
  const mine = [...(data?.listings ?? []), ...(data?.buyers ?? [])].filter((x: any) => x.assignee_id === data?.me).length;
  const names = (data?.names ?? {}) as Record<string, string>;

  return (
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Control</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">{waiting} waiting · oldest {oldest} day{oldest === 1 ? "" : "s"} · you are assigned {mine}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([["listings", `Listings (${data?.listings.length ?? 0})`], ["buyers", `Buyers (${data?.buyers.length ?? 0})`], ["history", "History"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => navigate({ search: { tab: k } })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {tab !== "history" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code name, company, reference…" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="waiting">In review</SelectItem>
              {tab === "listings" && <SelectItem value="edits">Live · edits pending</SelectItem>}
              {tab === "listings" && <SelectItem value="changes">Changes requested</SelectItem>}
            </SelectContent>
          </Select>
          {tab === "listings" && (
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="Business">Business</SelectItem><SelectItem value="Startup">Startup</SelectItem></SelectContent>
            </Select>
          )}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="newest">Newest first</SelectItem><SelectItem value="mine">Assigned to me</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : tab === "listings" ? (
        <>
          <Table head={["Listing", "Type", "Submitted", "Status", "Version", "Assigned", ""]}>
            {listings.length === 0 && <EmptyRow cols={7} text="Nothing waiting." />}
            {listings.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <SectorArt art={l.cover_art ?? l.startups?.sector} className="h-9 w-12 shrink-0 rounded-md" />
                    <div className="min-w-0"><div className="font-semibold">{l.startups?.startup_name ?? l.code_name}</div><div className="truncate text-xs text-muted-foreground">{l.ref_no} · {data?.emails?.[l.submitted_by] || names[l.submitted_by] || "—"}</div></div>
                  </div>
                </td>
                <td className="p-3">{typeOf(l)}</td>
                <td className="p-3"><div>{fmt(l.submitted_at)}</div><div className={cn("text-xs", days(l.submitted_at) >= 1 ? "text-amber-700" : "text-muted-foreground")}>{ago(l.submitted_at)}</div></td>
                <td className="p-3"><QueueChip l={l} /></td>
                <td className="p-3">v{l.version}</td>
                <td className="p-3">{l.assignee_id ? names[l.assignee_id] ?? "—" : <Button size="sm" variant="ghost" onClick={() => assign.mutate({ kind: "listing", id: l.id })}>Assign to me</Button>}</td>
                <td className="p-3 text-right"><Button size="sm" asChild><Link to="/approvals/listings/$id" params={{ id: l.id }}>Review</Link></Button></td>
              </tr>
            ))}
          </Table>
          <p className="text-sm text-muted-foreground">Waiting on sellers ({waitingOnSellers})</p>
        </>
      ) : tab === "buyers" ? (
        <Table head={["Buyer", "Type", "Company registration", "Work email", "LinkedIn", "Submitted", "Status", ""]}>
          {buyers.length === 0 && <EmptyRow cols={8} text="No buyers waiting." />}
          {buyers.map((b) => (
            <tr key={b.id} className="border-t border-border">
              <td className="p-3"><div className="font-semibold">{names[b.user_id] ?? b.work_email}</div><div className="text-xs text-muted-foreground">{b.company_name}</div></td>
              <td className="p-3">{b.buyer_type ?? "—"}</td>
              <td className="p-3">{b.registration_no ?? "—"}</td>
              <td className="p-3">{b.work_email}<div className={cn("text-xs", b.email_domain_match === false ? "text-amber-700" : "text-emerald-700")}>{b.email_domain_match == null ? "" : b.email_domain_match ? "Matches" : "Domain differs"}</div></td>
              <td className="p-3">{b.linkedin ? "Provided" : "—"}</td>
              <td className="p-3">{fmt(b.submitted_at)}<div className="text-xs text-muted-foreground">{ago(b.submitted_at)}</div></td>
              <td className="p-3"><StatusPill s={b.status === "more_info" ? "More info needed" : "Pending"} /></td>
              <td className="p-3 text-right"><Link to="/approvals/buyers/$id" params={{ id: b.id }} className="font-semibold text-primary hover:underline">Review →</Link></td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table head={["When", "Decision", "Item", "By"]}>
          {(data?.history ?? []).length === 0 && <EmptyRow cols={4} text="No activity yet." />}
          {(data?.history ?? []).map((h: any) => (
            <tr key={h.id} className="border-t border-border">
              <td className="p-3">{fmt(h.created_at)}</td>
              <td className="p-3 font-medium">{ACTION[h.action] ?? h.action}</td>
              <td className="p-3">{h.item_type === "listing" ? "Listing" : "Buyer"}{h.version ? ` · v${h.version}` : ""}{h.note ? <div className="text-xs text-muted-foreground">{h.note}</div> : null}</td>
              <td className="p-3">{names[h.actor_id] ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function typeOf(l: any) { return /startup/i.test(l.startups?.company_type ?? "") ? "Startup" : "Business"; }
function QueueChip({ l }: { l: any }) {
  const [label, tone] = l.approval_status === "changes_requested" ? ["Changes requested", "bg-purple-500/15 text-purple-700"]
    : l.status === "live" ? ["Live · edits pending", "bg-blue-500/15 text-blue-700"] : ["In review", "bg-amber-500/15 text-amber-800"];
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
