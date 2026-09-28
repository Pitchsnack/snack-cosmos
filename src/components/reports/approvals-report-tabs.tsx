import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listReportEvents } from "@/lib/report-orders.functions";
import { cn } from "@/lib/utils";
import {
  OrderStatusPill, Pill, dayMonth, dayMonthTime, hpOf, kindLabel, money, orderState, overdueDays, type ReportOrder,
} from "./report-order-bits";

export function Tile({ label, value, sub, amber }: { label: string; value: number; sub: string; amber?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold", amber && "text-amber-600")}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

const finLink = (o: { startup_id: string; kind: string }) => ({
  to: "/startups/$id/financials" as const, params: { id: o.startup_id }, search: { tab: o.kind === "valuation" ? "valuation" : undefined },
});
const dirLink = (id: string) => ({ to: "/startups" as const, search: { selected: id } as any });

function Company({ name, code, ref }: { name?: string | null; code?: string | null; ref?: string | null }) {
  return (
    <div>
      <div className="font-semibold">{name ?? "—"}</div>
      {(code || ref) && <div className="text-xs text-muted-foreground">{[code, ref].filter(Boolean).join(" · ")}</div>}
    </div>
  );
}

export function PaidReports({ orders, overdue }: { orders: ReportOrder[]; overdue: ReportOrder[] }) {
  const [show, setShow] = useState<"waiting" | "generated" | "delivered" | "all">("waiting");
  const [sort, setSort] = useState<"due" | "paid">("due");
  const counts = {
    waiting: orders.filter((o) => o.status === "paid").length,
    generated: orders.filter((o) => o.status === "generated").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };
  const rows = useMemo(() => {
    const l = orders.filter((o) => show === "all" || (show === "waiting" ? o.status === "paid" : o.status === show));
    const k = sort === "due" ? "due_at" : "paid_at";
    return [...l].sort((a, b) => +new Date((a as any)[k] ?? 0) - +new Date((b as any)[k] ?? 0));
  }, [orders, show, sort]);

  return (
    <div className="space-y-3">
      {overdue.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-2.5 text-sm">
          <span className="flex-1">⚠️ <b>{o.startups?.startup_name}</b> paid on {dayMonth(o.paid_at)} and the report is {overdueDays(o)} day{overdueDays(o) === 1 ? "" : "s"} overdue</span>
          <Link {...finLink(o)} className="rounded-lg bg-sidebar px-3 py-1.5 text-[13px] font-semibold text-sidebar-foreground">Open Financials →</Link>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="waiting">Waiting ({counts.waiting})</SelectItem>
            <SelectItem value="generated">Generated ({counts.generated})</SelectItem>
            <SelectItem value="delivered">Delivered ({counts.delivered})</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="due">Due date</SelectItem><SelectItem value="paid">Paid date</SelectItem></SelectContent>
        </Select>
      </div>
      <Tbl head={["Company", "Report", "Paid", "Due", "Status", ""]}>
        {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No orders here.</td></tr>}
        {rows.map((o) => {
          const st = orderState(o);
          const hp = hpOf(o);
          const daysLeft = o.due_at ? Math.ceil((+new Date(o.due_at) - Date.now()) / 86_400_000) : 0;
          return (
            <tr key={o.id} className="border-t border-border align-top">
              <td className="p-3"><Company name={o.startups?.startup_name} code={hp?.code_name} ref={hp?.ref_no} /></td>
              <td className="p-3">{kindLabel(o.kind)}<div className="text-xs text-muted-foreground">{o.ref}</div></td>
              <td className="p-3">{dayMonthTime(o.paid_at)}<div className="text-xs text-muted-foreground">{o.method ?? "—"} · {money(o)}</div></td>
              <td className="p-3">
                <b>{dayMonth(o.due_at)}</b>
                <div className={cn("text-xs", st === "delivered" ? "text-emerald-700" : st === "overdue" ? "font-bold text-red-700" : "text-amber-700")}>
                  {st === "delivered" ? `delivered ${dayMonth(o.delivered_at)}` : st === "overdue" ? `overdue ${overdueDays(o)} day${overdueDays(o) === 1 ? "" : "s"}` : `${Math.max(0, daysLeft)} day${daysLeft === 1 ? "" : "s"}`}
                </div>
              </td>
              <td className="p-3"><OrderStatusPill o={o} /></td>
              <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1">
                  {st === "delivered" ? (
                    <Button size="sm" variant="outline" asChild><Link {...finLink(o)}>View report</Link></Button>
                  ) : (
                    <Link {...finLink(o)} className="rounded-lg bg-sidebar px-3 py-1.5 text-[13px] font-semibold text-sidebar-foreground">
                      {st === "generated" ? "Review & publish →" : "Open Financials →"}
                    </Link>
                  )}
                  <Link {...dirLink(o.startup_id)} className="text-xs text-blue-600 hover:underline">Startup Directory ↗</Link>
                </div>
              </td>
            </tr>
          );
        })}
      </Tbl>
    </div>
  );
}

type Row = {
  id: string; at: string; type: "listing" | "buyer" | "report"; event: string; tone: "green" | "amber" | "red";
  who: string; sub: string; detail: string; item: string; by: string; startupId?: string | null; itemId?: string; orderKind?: string;
};

const LISTING_EVENT: Record<string, [string, Row["tone"], string]> = {
  submit: ["Submitted", "amber", "changes"], resubmit: ["Submitted", "amber", "changes"], approve: ["Approved & published", "green", "approved"],
  request_changes: ["Changes requested", "amber", "changes"], reject: ["Declined", "red", "declined"], verify: ["Buyer verified", "green", "approved"],
  more_info: ["Changes requested", "amber", "changes"], decline: ["Declined", "red", "declined"],
};
const REPORT_EVENT: Record<string, [string, Row["tone"], string]> = {
  paid: ["Report paid", "amber", "paid"], generated: ["Report generated", "amber", "changes"], published: ["Report published", "green", "published"], overdue: ["Report overdue", "red", "overdue"],
};

export function HistoryTab({ approvalEvents, startupInfo, buyerInfo, names }: {
  approvalEvents: any[]; startupInfo: Record<string, { name: string; code: string | null; ref: string | null }>; buyerInfo: Record<string, any>; names: Record<string, string>;
}) {
  const fn = useServerFn(listReportEvents);
  const { data } = useQuery({ queryKey: ["approvals", "report-events"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [ev, setEv] = useState("all");
  const [period, setPeriod] = useState("30");
  const [page, setPage] = useState(1);

  const all = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const h of approvalEvents) {
      const m = LISTING_EVENT[h.action];
      if (!m) continue;
      const isListing = h.item_type === "listing";
      const si = h.startup_id ? startupInfo[h.startup_id] : undefined;
      const b = buyerInfo[h.item_id];
      rows.push({
        id: h.id, at: h.created_at, type: isListing ? "listing" : "buyer", event: m[0] + "|" + m[2], tone: m[1],
        who: isListing ? si?.name ?? "—" : names[b?.user_id] ?? "Buyer",
        sub: isListing ? [si?.code, si?.ref].filter(Boolean).join(" · ") : [b?.company_name, b?.buyer_type].filter(Boolean).join(" · "),
        detail: h.note ?? "", item: isListing ? `Listing${h.version ? ` · v${h.version}` : ""}` : "Buyer",
        by: names[h.actor_id] ?? "—", startupId: h.startup_id, itemId: h.item_id,
      });
    }
    for (const e of (data?.events ?? []) as any[]) {
      const m = REPORT_EVENT[e.event];
      const o = e.report_orders;
      const hpRaw = o?.startups?.hidden_profiles;
      const hp = Array.isArray(hpRaw) ? hpRaw[0] : hpRaw;
      const by = !e.actor_id ? "System" : `${data?.names?.[e.actor_id] ?? "—"}${e.event === "paid" ? " (seller)" : ""}`;
      rows.push({
        id: e.id, at: e.created_at, type: "report", event: m[0] + "|" + m[2], tone: m[1],
        who: o?.startups?.startup_name ?? "—", sub: [hp?.code_name, hp?.ref_no].filter(Boolean).join(" · "),
        detail: e.note ?? "", item: `${kindLabel(o?.kind)} · ${o?.ref}`, by, startupId: o?.startup_id, orderKind: o?.kind,
      });
    }
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [approvalEvents, data, startupInfo, buyerInfo, names]);

  const filtered = all.filter((r) => {
    if (type !== "all" && r.type !== type) return false;
    if (ev !== "all" && r.event.split("|")[1] !== ev) return false;
    if (period !== "all" && Date.now() - +new Date(r.at) > Number(period) * 86_400_000) return false;
    if (q && !`${r.who} ${r.sub} ${r.item}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const pageRows = filtered.slice((page - 1) * 50, page * 50);
  const pages = Math.max(1, Math.ceil(filtered.length / 50));

  const dayKey = (d: string) => {
    const x = new Date(d); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (x.toDateString() === t.toDateString()) return "TODAY";
    if (x.toDateString() === y.toDateString()) return "YESTERDAY";
    return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["When", "Event", "Company / buyer", "Detail", "Item", "By"].join(",")]
      .concat(filtered.map((r) => [dayMonthTime(r.at), r.event.split("|")[0], `${r.who} ${r.sub}`, r.detail, r.item, r.by].map(esc).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "approvals-history.csv";
    a.click();
  };

  let lastDay = "";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search company, code name, buyer or order ref…" className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </div>
        <Sel value={type} onChange={setType} opts={[["all", "All types"], ["listing", "Listings"], ["buyer", "Buyers"], ["report", "Reports"]]} />
        <Sel value={ev} onChange={setEv} opts={[["all", "All events"], ["approved", "Approved"], ["changes", "Changes"], ["declined", "Declined"], ["paid", "Paid"], ["published", "Published"], ["overdue", "Overdue"]]} />
        <Sel value={period} onChange={setPeriod} opts={[["30", "30 days"], ["90", "90 days"], ["all", "All"]]} />
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
      </div>
      <Tbl head={["When", "Event", "Company / buyer", "Detail", "Item", "By", ""]}>
        {pageRows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No activity yet.</td></tr>}
        {pageRows.map((r) => {
          const d = dayKey(r.at);
          const head = d !== lastDay;
          lastDay = d;
          return [
            head && <tr key={r.id + "-d"}><td colSpan={7} className="bg-muted/40 px-3 py-1.5 text-[11px] font-bold tracking-wider text-muted-foreground">{d}</td></tr>,
            <tr key={r.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap p-3 text-muted-foreground">{dayMonthTime(r.at)}</td>
              <td className="p-3"><Pill tone={r.tone}>{r.event.split("|")[0]}</Pill></td>
              <td className="p-3"><div className="font-semibold">{r.who}</div>{r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}</td>
              <td className="max-w-[230px] p-3 text-xs text-muted-foreground">{r.detail || "—"}</td>
              <td className="p-3">{r.item}</td>
              <td className="p-3">{r.by}</td>
              <td className="p-3 text-right">
                <div className="flex flex-col items-end gap-1 text-xs">
                  {r.type === "report" && r.startupId && <Link {...finLink({ startup_id: r.startupId, kind: r.orderKind ?? "financials" })} className="font-semibold text-blue-600 hover:underline">Open Financials</Link>}
                  {r.type === "listing" && r.itemId && <Link to="/approvals/listings/$id" params={{ id: r.itemId }} className="font-semibold text-blue-600 hover:underline">Review</Link>}
                  {r.type === "buyer" && r.itemId && <Link to="/approvals/buyers/$id" params={{ id: r.itemId }} className="font-semibold text-blue-600 hover:underline">Review</Link>}
                  {r.type !== "buyer" && r.startupId && <Link {...dirLink(r.startupId)} className="text-blue-600 hover:underline">Startup Directory ↗</Link>}
                  {r.type === "buyer" && r.itemId && <Link to="/approvals/buyers/$id" params={{ id: r.itemId }} className="text-blue-600 hover:underline">Buyer profile ↗</Link>}
                </div>
              </td>
            </tr>,
          ];
        })}
      </Tbl>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Tbl({ head, children }: { head: string[]; children: React.ReactNode }) {
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
