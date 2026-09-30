import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { autoEnrichFinancials, clearStartupFinancials, saveStartupFinancials } from "@/lib/financials-edit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authoriseSeller, finaliseAuthorise, listReportEvents, markReportGenerated, undoAuthorise } from "@/lib/report-orders.functions";
import { cn } from "@/lib/utils";
import { Pill, dayMonth, dayMonthTime, hpOf, kindLabel, money, type ReportOrder } from "./report-order-bits";

export function Tile({ label, value, sub, amber, green }: { label: string; value: number; sub: string; amber?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold", amber && "text-[#B45309]", green && "text-[#047857]")}>{value}</div>
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

export const businessDaysSince = (d: string) => {
  let n = 0; const x = new Date(d); const now = new Date();
  while (x < now) { x.setDate(x.getDate() + 1); if (x > now) break; const w = x.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
};
/** Overdue: paid more than 2 business days ago and the seller still can't see it. */
export const isOverdue = (o: ReportOrder) => o.status !== "delivered" && businessDaysSince(o.paid_at) > 2;
export const overdueBy = (o: ReportOrder) => Math.max(1, businessDaysSince(o.paid_at) - 2);

type GenState = "running" | "failed";

export function PaidReports({ orders }: { orders: ReportOrder[] }) {
  const qc = useQueryClient();
  const enrich = useServerFn(autoEnrichFinancials);
  const clear = useServerFn(clearStartupFinancials);
  const save = useServerFn(saveStartupFinancials);
  const genFn = useServerFn(markReportGenerated);
  const authFn = useServerFn(authoriseSeller);
  const undoFn = useServerFn(undoAuthorise);
  const finFn = useServerFn(finaliseAuthorise);
  const [show, setShow] = useState<"waiting" | "authorised" | "all">("waiting");
  const [gen, setGen] = useState<Record<string, GenState>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ReportOrder | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const refresh = () => { qc.invalidateQueries({ queryKey: ["report-orders"] }); qc.invalidateQueries({ queryKey: ["approvals"] }); };

  // Catch-up: finalise authorisations whose Undo window passed without the timer firing
  // (tab closed / navigated away). finaliseAuthorise is idempotent.
  const swept = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const o of orders) {
      if (o.status !== "delivered" || !o.delivered_at || timers.current[o.id] || swept.current.has(o.id)) continue;
      if (Date.now() - new Date(o.delivered_at).getTime() < 7000) continue;
      swept.current.add(o.id);
      void finFn({ data: { orderId: o.id } });
    }
  }, [orders, finFn]);
  // On unmount, finalise pending authorisations immediately instead of dropping them.
  useEffect(() => () => {
    for (const [id, t] of Object.entries(timers.current)) { clearTimeout(t); void finFn({ data: { orderId: id } }); }
  }, [finFn]);

  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLButtonElement>(`[data-row-action="${focusId}"]`);
    if (el && !el.disabled) { el.focus(); setFocusId(null); }
  });

  const waiting = orders.filter((o) => o.status !== "delivered").sort((a, b) => +new Date(a.paid_at) - +new Date(b.paid_at));
  const authorised = orders.filter((o) => o.status === "delivered").sort((a, b) => +new Date(b.delivered_at ?? 0) - +new Date(a.delivered_at ?? 0));
  const rows = show === "waiting" ? waiting : show === "authorised" ? authorised : [...waiting, ...authorised];
  const overdue = waiting.filter(isOverdue);

  const generate = async (o: ReportOrder) => {
    setGen((g) => ({ ...g, [o.id]: "running" }));
    try {
      const r = await enrich({ data: { startupId: o.startup_id } });
      if (r.status !== "ok" || !r.years?.length) throw new Error(r.message ?? "No data");
      await clear({ data: { startupId: o.startup_id } });
      await save({ data: { startupId: o.startup_id, years: r.years, ...(r.profile ? { profile: r.profile } : {}),
        provenance: { source: "DBD_DATA_WAREHOUSE", sourceReference: r.sourceReference ?? null, matchedRegisteredNumber: r.matchedRegisteredNumber ?? null,
          matchedRegisteredName: r.matchedRegisteredName ?? null, retrievedAt: r.retrievedAt ?? null } } as any });
      const years = (r.years as any[]).map((y) => Number(y?.fiscalYear ?? y?.fiscal_year ?? y?.year)).filter(Boolean);
      await genFn({ data: { orderId: o.id, years, regNo: r.matchedRegisteredNumber ?? null } });
      setGen((g) => { const n = { ...g }; delete n[o.id]; return n; });
      await qc.invalidateQueries({ queryKey: ["report-orders"] });
      setFocusId(o.id);
      toast.success(`Report ready for ${o.startups?.startup_name ?? "this company"}. Authorise the seller when you're happy with it.`);
    } catch {
      setGen((g) => ({ ...g, [o.id]: "failed" }));
    }
  };

  const authorise = async (o: ReportOrder) => {
    try {
      const { prevStatus } = await authFn({ data: { orderId: o.id } });
      await qc.invalidateQueries({ queryKey: ["report-orders"] });
      setFocusId(o.id);
      const name = o.startups?.startup_name ?? "The seller";
      timers.current[o.id] = setTimeout(() => { delete timers.current[o.id]; void finFn({ data: { orderId: o.id } }).then(refresh); }, 6000);
      toast.success(`${name} can now see its ${o.kind === "valuation" ? "estimated valuation" : "financial report"}.`, {
        duration: 6000,
        action: { label: "Undo", onClick: async () => {
          clearTimeout(timers.current[o.id]); delete timers.current[o.id];
          await undoFn({ data: { orderId: o.id, prevStatus: prevStatus === "generated" ? "generated" : "paid" } });
          refresh();
        } },
      });
    } catch (e) { toast.error((e as Error).message); }
  };

  const action = (o: ReportOrder) => {
    const g = gen[o.id];
    const base = "h-8 rounded-lg px-3 text-[13px] font-semibold";
    if (o.status === "delivered") return <Button data-row-action={o.id} size="sm" variant="outline" className={base} onClick={() => setViewing(o)}>View report</Button>;
    if (o.ready_at && g !== "running") return <Button data-row-action={o.id} size="sm" className={cn(base, "bg-[#111827] text-white hover:bg-[#111827]/90")} onClick={() => authorise(o)}>Authorise seller</Button>;
    return <Button data-row-action={o.id} size="sm" variant="outline" className={base} disabled={g === "running"} onClick={() => generate(o)}>{g === "failed" ? "Try again" : "Generate report"}</Button>;
  };

  return (
    <div className="space-y-3">
      {overdue.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-2.5 text-sm">
          <span className="flex-1">⚠ <b>{o.startups?.startup_name}</b> paid on {dayMonth(o.paid_at)} and still can't see the report · {overdueBy(o)} day{overdueBy(o) === 1 ? "" : "s"} overdue</span>
          {action(o)}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Show</span>
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {([["waiting", "Waiting", waiting.length], ["authorised", "Authorised", authorised.length], ["all", "All", orders.length]] as const).map(([k, l, n]) => (
            <button key={k} type="button" onClick={() => setShow(k)}
              className={cn("rounded-md px-3 py-1 text-[13px] font-semibold", show === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {l} {n}
            </button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-[13px] text-[#4B5563]"><Lock className="h-3.5 w-3.5 text-[#6B7280]" />A seller sees their report only after you authorise them. A report can be ready before the seller asks.</p>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        <table className="w-full text-[13.5px]">
          <thead className="bg-[#FAFBFC] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-[#6A7181]">
            <tr>{["Company", "Report", "Seller asked", "Report ready", "Seller can see it", ""].map((h, i) => <th key={i} className="px-5 py-2.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No reports here.</td></tr>}
            {rows.map((o) => {
              const hp = hpOf(o);
              const g = gen[o.id];
              const before = o.ready_at && +new Date(o.ready_at) < +new Date(o.paid_at);
              return (
                <tr key={o.id} className="h-16 border-t border-[#EEF0F3] align-middle">
                  <td className="px-5 py-3">
                    <Link {...dirLink(o.startup_id)} className="text-[14px] font-semibold text-[#111827] hover:underline">{o.startups?.startup_name ?? "—"}</Link>
                    <div className="text-xs text-[#6B7280]">{[hp?.code_name, hp?.ref_no].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-5 py-3">{kindLabel(o.kind)}<div className="text-xs text-[#6B7280]">{o.ref}</div></td>
                  <td className="px-5 py-3">{dayMonth(o.paid_at)}
                    <div className="text-xs">{isOverdue(o) ? <span className="font-semibold text-[#B91C1C]">overdue {overdueBy(o)} day{overdueBy(o) === 1 ? "" : "s"}</span> : <span className="text-[#6B7280]">paid {money(o)}</span>}</div>
                  </td>
                  <td className="px-5 py-3">
                    {g === "running" ? <span className="inline-flex items-center gap-1.5 text-[#B45309]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</span>
                      : g === "failed" ? <span className="text-[#B91C1C]">✗ Couldn't generate</span>
                      : o.ready_at ? <span className="font-semibold text-[#047857]">✓ Ready · {dayMonth(o.ready_at)}</span>
                      : <span className="text-[#9CA3AF]">✗ Not generated yet</span>}
                    {before && !g && <div className="text-xs text-[#6B7280]">before the seller asked</div>}
                  </td>
                  <td className="px-5 py-3">
                    {o.status === "delivered" ? <><span className="font-semibold text-[#047857]">✓ Authorised · {dayMonth(o.delivered_at)}</span>{o.delivered_by_name && <div className="text-xs text-[#6B7280]">by {o.delivered_by_name}</div>}</>
                      : <span className="inline-flex items-center gap-1.5 text-[#9CA3AF]"><Lock className="h-3.5 w-3.5" />Not yet</span>}
                  </td>
                  <td className="px-5 py-3 text-right">{action(o)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {viewing && <ReportViewerDialog order={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ReportViewerDialog({ order, onClose }: { order: ReportOrder; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[min(1100px,calc(100vw-32px))] p-0">
        <DialogTitle className="px-5 pt-4 text-base">{order.startups?.startup_name} · {kindLabel(order.kind)}</DialogTitle>
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <StartupFinancialsPage id={order.startup_id} workspace="startups" initialTab={order.kind === "valuation" ? "valuation" : undefined} />
        </div>
      </DialogContent>
    </Dialog>
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
  paid: ["Report paid", "amber", "paid"], generated: ["Report generated", "amber", "changes"], published: ["Seller authorised", "green", "published"], overdue: ["Report overdue", "red", "overdue"],
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
        <Sel value={ev} onChange={setEv} opts={[["all", "All events"], ["approved", "Approved"], ["changes", "Changes"], ["declined", "Declined"], ["paid", "Paid"], ["published", "Authorised"], ["overdue", "Overdue"]]} />
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
