import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DbdStorePanel } from "@/components/approvals/dbd-store-panel";
import { listPaidReports, linkStoredDbd, viewStoredDbd } from "@/lib/paid-reports.functions";
import { extractDbd, deleteDbd } from "@/lib/dbd-store.functions";
import { authoriseSeller, finaliseAuthorise } from "@/lib/report-orders.functions";
import {
  ORDERABLE, PAID_NAMES, PAID_ORDER, PAID_SHORT, nextStep, readyOrders, waitingChip, hasData, noOrders,
  type PaidCompany, type PaidOrder, type PaidSort, type PaidTile,
} from "@/lib/paid-reports";
import type { HubKey } from "@/lib/reports-hub";
import { cn } from "@/lib/utils";
import { AdminReportsView } from "./admin-reports-view";

export const dm = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }) : "—");
export const dmy = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "—");
const baht = (n: number | null | undefined) => (n ? `฿${Number(n).toLocaleString("en-US")}` : "Price not set");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

type Prices = Record<string, number | null>;
type Confirm =
  | { kind: "authorise"; companies: PaidCompany[] }
  | { kind: "refresh"; companies: PaidCompany[]; link?: boolean }
  | { kind: "delete"; company: PaidCompany };

const TILES: [PaidTile, string][] = [["needs", "Needs DBD data"], ["ready", "Ready to authorise"], ["overdue", "Overdue"], ["authorised", "Authorised"], ["no_orders", "Data ready · no orders"], ["all", "All companies"]];

export function PaidReportsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPaidReports);
  const linkFn = useServerFn(linkStoredDbd);
  const extractFn = useServerFn(extractDbd);
  const deleteFn = useServerFn(deleteDbd);
  const authFn = useServerFn(authoriseSeller);
  const finFn = useServerFn(finaliseAuthorise);
  const [tile, setTile] = useState<PaidTile>("needs");
  const [qIn, setQIn] = useState("");
  const [q, setQ] = useState("");
  const [report, setReport] = useState<"all" | HubKey>("all");
  const [sort, setSort] = useState<PaidSort>("waiting");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<string | null>(null);
  const [view, setView] = useState<{ id: string; key?: HubKey } | null>(null);
  const [viewData, setViewData] = useState<{ reg: string; company: PaidCompany } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQ(qIn); setPage(1); }, 250); return () => clearTimeout(t); }, [qIn]);
  const query = useQuery({
    queryKey: ["paid-reports", tile, q, report, sort, page],
    queryFn: () => listFn({ data: { tile, q, report: report as any, sort, page } }),
    placeholderData: keepPreviousData,
  });
  const d = query.data;
  const rows = d?.rows ?? [];
  const prices: Prices = d?.prices ?? {};
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["paid-reports"] });
    void qc.invalidateQueries({ queryKey: ["paid-reports-count"] });
    void qc.invalidateQueries({ queryKey: ["report-orders"] });
    void qc.invalidateQueries({ queryKey: ["reports-hub"] });
    void qc.invalidateQueries({ queryKey: ["dbd-store"] });
  };
  const known = new Map<string, PaidCompany>();
  for (const r of rows) known.set(r.startupId, r);
  const [pinned, setPinned] = useState<Record<string, PaidCompany>>({});
  const find = (id: string | null) => (id ? known.get(id) ?? pinned[id] ?? null : null);
  const openPanel = (c: PaidCompany) => { setPinned((p) => ({ ...p, [c.startupId]: c })); setPanel(c.startupId); };
  const openView = (c: PaidCompany, key?: HubKey) => { setPinned((p) => ({ ...p, [c.startupId]: c })); setView({ id: c.startupId, key }); };
  const mark = (id: string, msg: string | null) => setBusy((b) => { const n = { ...b }; if (msg) n[id] = msg; else delete n[id]; return n; });

  /** Get DBD data for one company: the store is checked first; stored data is linked, never fetched twice. */
  async function getData(c: PaidCompany): Promise<"linked" | "fetched" | "failed"> {
    if (!c.reg) { setFailed((f) => ({ ...f, [c.startupId]: "Add the 13-digit registration number first" })); return "failed"; }
    mark(c.startupId, "Checking the store…");
    setFailed((f) => { const n = { ...f }; delete n[c.startupId]; return n; });
    try {
      if (c.dbd.state === "stored") {
        mark(c.startupId, "Found in store · linking…");
        const r = await linkFn({ data: { startupId: c.startupId } });
        if (!r.ok) throw new Error(r.error);
        return "linked";
      }
      mark(c.startupId, "Not stored · fetching from DBD…");
      const r = await extractFn({ data: { reg: c.reg, refresh: false, replaceManual: false } });
      if (!r.ok) {
        if (/already stored/i.test(r.error)) { mark(c.startupId, "Found in store · linking…"); const l = await linkFn({ data: { startupId: c.startupId } }); if (!l.ok) throw new Error(l.error); return "linked"; }
        throw new Error(r.error);
      }
      return "fetched";
    } catch (e) {
      setFailed((f) => ({ ...f, [c.startupId]: (e as Error).message }));
      return "failed";
    } finally { mark(c.startupId, null); }
  }
  async function useOrExtract(c: PaidCompany) {
    const r = await getData(c);
    refreshAll();
    if (r === "linked") toast.success(`${c.name}: DBD data linked. Reused from the store, not fetched again.`);
    else if (r === "fetched") toast.success(`${c.name}: DBD data extracted. The reports are ready to authorise.`);
    else toast.error(`${c.name}: couldn't get the DBD data. Try again or enter the data by hand.`);
  }
  async function bulkGet(list: PaidCompany[]) {
    let linked = 0, fetched = 0;
    for (const c of list) { const r = await getData(c); if (r === "linked") linked++; if (r === "fetched") fetched++; }
    setSel(new Set()); refreshAll();
    toast.success(`Checked the store first: ${linked} already stored (linked, no fetch), ${fetched} fetched from DBD.`);
  }
  async function doRefresh(list: PaidCompany[], link?: boolean) {
    const regs = new Map<string, PaidCompany>();
    for (const c of list) if (c.reg && !regs.has(c.reg)) regs.set(c.reg, c);
    let ok = 0;
    for (const [reg, c] of regs) {
      list.filter((x) => x.reg === reg).forEach((x) => mark(x.startupId, "Fetching from DBD again…"));
      try {
        const r = await extractFn({ data: { reg, refresh: true, replaceManual: false } });
        if (!r.ok) throw new Error(r.error);
        if (link) { const l = await linkFn({ data: { startupId: c.startupId } }); if (!l.ok) throw new Error(l.error); }
        ok++;
      } catch (e) {
        list.filter((x) => x.reg === reg).forEach((x) => setFailed((f) => ({ ...f, [x.startupId]: `DBD data couldn't be refreshed: ${(e as Error).message}.` })));
      } finally { list.filter((x) => x.reg === reg).forEach((x) => mark(x.startupId, null)); }
    }
    setSel(new Set()); refreshAll();
    if (!ok) { toast.error("DBD data couldn't be refreshed. The data stored before is kept."); return; }
    toast.success(regs.size === 1 ? `${list[0].name}: DBD data refreshed. Reports rebuilt from the new data.` : `DBD data refreshed for ${ok} companies. Their reports were rebuilt.`);
  }
  async function doAuthorise(list: PaidCompany[]) {
    const ids = [...new Set(list.flatMap((c) => readyOrders(c).map((o) => o.id)))];
    let n = 0;
    for (const id of ids) {
      try { await authFn({ data: { orderId: id } }); await finFn({ data: { orderId: id } }); n++; }
      catch (e) { toast.error((e as Error).message); }
    }
    setSel(new Set()); refreshAll();
    if (n) toast.success(n === 1 ? "Seller authorised. They can now see the report." : `${n} reports authorised.`);
  }
  async function doDelete(c: PaidCompany) {
    if (!c.reg) return;
    try { await deleteFn({ data: { reg: c.reg } }); toast.success("DBD data deleted."); } catch (e) { toast.error((e as Error).message); }
    refreshAll();
  }

  const selected = rows.filter((r) => sel.has(r.startupId));
  const selGet = selected.filter((c) => !hasData(c));
  const selRefresh = selected.filter((c) => hasData(c));
  const selAuth = selected.filter((c) => readyOrders(c).length);
  const selAuthN = new Set(selAuth.flatMap((c) => readyOrders(c).map((o) => o.id))).size;
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.startupId));
  const panelCo = find(panel);
  const viewCo = view ? find(view.id) : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4 pb-24" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <div>
          <div className="text-xs text-muted-foreground">Admin › Paid reports</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Paid reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reports clients have paid for, and companies whose reports are ready before anyone orders. Get the company's DBD data, then authorise the seller.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {TILES.map(([k, label]) => (
            <Button key={k} type="button" variant="outline" aria-pressed={tile === k} onClick={() => { setTile(k); setPage(1); setSel(new Set()); }}
              className={cn("h-auto min-w-0 flex-col items-start whitespace-normal rounded-lg border bg-card px-4 py-3 text-left transition-colors", tile === k ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-muted-foreground/40")}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={cn("text-2xl font-bold", k === "overdue" && (d?.counts.overdue ?? 0) > 0 && "text-destructive")}>{d?.counts[k] ?? "–"}</div>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input value={qIn} onChange={(e) => setQIn(e.target.value)} placeholder="Search company, PS ref, RO ref or registration no." className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
          </div>
          <Select value={report} onValueChange={(v) => { setReport(v as any); setPage(1); }}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All reports</SelectItem>{ORDERABLE.map((k) => <SelectItem key={k} value={k}>{PAID_NAMES[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v as PaidSort); setPage(1); }}>
            <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="waiting">Waiting longest first</SelectItem><SelectItem value="newest">Newest paid first</SelectItem><SelectItem value="az">Company A–Z</SelectItem></SelectContent>
          </Select>
        </div>

        <p className="text-[13px] text-muted-foreground"><b className="text-foreground">Sellers see a report only after you authorise them.</b> Before any DBD fetch, the store is checked by registration number. Stored data is reused, never fetched twice.</p>

        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <table className="w-full text-[13.5px]">
            <thead className="hidden bg-muted/40 text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground md:table-header-group">
              <tr>
                <th className="w-10 px-4 py-2.5"><Checkbox aria-label="Select every company on this page" checked={allOnPage} onCheckedChange={(v) => setSel(v ? new Set(rows.map((r) => r.startupId)) : new Set())} /></th>
                {["Company", "Paid reports", "DBD data", "Paid", "Waiting", "Next step"].map((h, i) => <th key={h} className={cn("px-3 py-2.5", i === 5 && "text-right")}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {query.isPending && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {query.error && <tr><td colSpan={7} className="p-8 text-center text-destructive">{(query.error as Error).message}</td></tr>}
              {d && rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No companies here.</td></tr>}
              {rows.map((c) => (
                <CompanyRow key={c.startupId} c={c} checked={sel.has(c.startupId)} busy={busy[c.startupId]} failed={failed[c.startupId]}
                  onCheck={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(c.startupId); else n.delete(c.startupId); return n; })}
                  onOpen={() => openPanel(c)} onUse={() => useOrExtract(c)} onAuthorise={() => setConfirm({ kind: "authorise", companies: [c] })}
                  onView={() => openView(c)} onRefresh={() => setConfirm({ kind: "refresh", companies: [c] })} />
              ))}
            </tbody>
          </table>
        </div>

        {d && d.total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{(d.page - 1) * 25 + 1}–{Math.min(d.page * 25, d.total)} of {d.total} companies</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={d.page <= 1} onClick={() => { setPage(d.page - 1); setSel(new Set()); }}>Previous</Button>
              <Button size="sm" variant="outline" disabled={d.page >= d.pages} onClick={() => { setPage(d.page + 1); setSel(new Set()); }}>Next</Button>
            </div>
          </div>
        )}

        {sel.size > 0 && (
          <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
            <span className="font-semibold">{sel.size} selected</span>
            <Button size="sm" variant="secondary" disabled={!selGet.length} onClick={() => bulkGet(selGet)}>Get DBD data ({selGet.length})</Button>
            <Button size="sm" variant="secondary" disabled={!selRefresh.length} onClick={() => setConfirm({ kind: "refresh", companies: selRefresh })}>Refresh from DBD ({selRefresh.length})</Button>
            <Button size="sm" disabled={!selAuthN} onClick={() => setConfirm({ kind: "authorise", companies: selAuth })} className="bg-accent text-accent-foreground hover:bg-accent/90">Authorise {selAuthN} reports</Button>
            <button type="button" className="px-2 text-background/80 underline-offset-2 hover:underline" onClick={() => setSel(new Set())}>Clear</button>
          </div>
        )}

        <Sheet open={!!panelCo} onOpenChange={(v) => !v && setPanel(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[520px]">
            {panelCo && <SidePanel c={panelCo} prices={prices} busy={busy[panelCo.startupId]} failed={failed[panelCo.startupId]}
              onUse={() => useOrExtract(panelCo)} onViewData={() => panelCo.reg && setViewData({ reg: panelCo.reg, company: panelCo })}
              onRefresh={(link) => setConfirm({ kind: "refresh", companies: [panelCo], link })} onDelete={() => setConfirm({ kind: "delete", company: panelCo })}
              onAuthorise={(o) => setConfirm({ kind: "authorise", companies: [{ ...panelCo, orders: panelCo.orders.filter((x) => x.id === o.id) }] })}
              onView={(key) => openView(panelCo, key)} onChanged={refreshAll} />}
          </SheetContent>
        </Sheet>

        {viewCo && <AdminReportsView c={viewCo} initial={view?.key} busy={busy[viewCo.startupId]} onClose={() => setView(null)}
          onUse={() => useOrExtract(viewCo)} onRefresh={() => setConfirm({ kind: "refresh", companies: [viewCo] })}
          onAuthorise={(o) => setConfirm({ kind: "authorise", companies: [{ ...viewCo, orders: viewCo.orders.filter((x) => x.id === o.id) }] })} />}

        {viewData && <ViewDataDialog reg={viewData.reg} company={viewData.company} onClose={() => setViewData(null)} />}

        <ConfirmBox confirm={confirm} onClose={() => setConfirm(null)} onGo={(c) => {
          setConfirm(null);
          if (c.kind === "authorise") void doAuthorise(c.companies);
          else if (c.kind === "refresh") void doRefresh(c.companies, c.link);
          else void doDelete(c.company);
        }} />
      </div>
    </TooltipProvider>
  );
}

const tagTone = (o: PaidOrder, data: boolean) => o.status === "delivered" ? "bg-[#DCFCE7] text-[#166534]" : o.status === "generated" && data ? "bg-[#FEF3C7] text-[#92400E]" : "bg-muted text-muted-foreground";
const chipTone = { red: "bg-[#FEE2E2] text-[#B91C1C]", grey: "bg-muted text-muted-foreground", green: "bg-[#DCFCE7] text-[#166534]" };

function DbdText({ c, busy, failed, onRefresh }: { c: PaidCompany; busy?: string; failed?: string; onRefresh?: () => void }) {
  if (busy) return <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{busy}</span>;
  if (failed) return <span className="text-destructive">{failed}</span>;
  const s = c.dbd;
  if (s.state === "linked") {
    const verb = s.how === "linked" ? "Linked" : s.how === "refreshed" ? "Refreshed" : s.how === "manual" ? "Entered by hand" : "Extracted";
    return <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#16A34A]" />{verb} {dm(s.at)}
      {onRefresh && <Tooltip><TooltipTrigger asChild><button type="button" aria-label="Refresh from DBD" onClick={(e) => { e.stopPropagation(); onRefresh(); }} className="grid h-[26px] w-[26px] place-items-center rounded-md border border-border hover:bg-muted"><RefreshCw className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent>Refresh from DBD</TooltipContent></Tooltip>}</span>;
  }
  if (s.state === "stored") return <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2563EB]" />Already stored · {dm(s.at)}</span>;
  if (s.state === "no_number") return <span className="inline-flex items-center gap-1.5 text-muted-foreground"><i className="h-2 w-2 rounded-full bg-destructive" />No registration number</span>;
  return <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-destructive" />Not stored yet</span>;
}

function NextButton({ c, busy, failed, onUse, onAuthorise, onView }: { c: PaidCompany; busy?: string; failed?: string; onUse: () => void; onAuthorise: () => void; onView: () => void }) {
  const s = nextStep(c);
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f(); };
  if (busy) return <Button size="sm" disabled className="h-8"><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Working…</Button>;
  if (s.kind === "use") return <Button size="sm" variant="outline" className="h-8" onClick={stop(onUse)}>Use stored data</Button>;
  if (s.kind === "extract") return <Button size="sm" className="h-8 bg-foreground text-background hover:bg-foreground/90" disabled={!c.reg} onClick={stop(onUse)}>{failed ? "Try again" : "Extract data"}</Button>;
  if (s.kind === "authorise") return <Button size="sm" className="h-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={stop(onAuthorise)}>{(s.n ?? 0) > 1 ? `Authorise ${s.n}` : "Authorise"}</Button>;
  return <Button variant="link" className="h-auto p-0 text-[13px] font-semibold" onClick={stop(onView)}>{s.kind === "view" ? "View reports" : "Open reports"}</Button>;
}

function CompanyRow({ c, checked, busy, failed, onCheck, onOpen, onUse, onAuthorise, onView, onRefresh }: {
  c: PaidCompany; checked: boolean; busy?: string; failed?: string; onCheck: (v: boolean) => void; onOpen: () => void; onUse: () => void; onAuthorise: () => void; onView: () => void; onRefresh: () => void;
}) {
  const w = waitingChip(c);
  const data = hasData(c);
  const tags = noOrders(c) ? <span className="text-muted-foreground">None ordered · 7 reports ready</span> : <div className="flex flex-wrap gap-1">{c.orders.map((o) => (
    <Tooltip key={o.id + o.key}><TooltipTrigger asChild><span className={cn("rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold", tagTone(o, data))}>{PAID_SHORT[o.key]}</span></TooltipTrigger><TooltipContent>{o.ref} · {PAID_NAMES[o.key]}</TooltipContent></Tooltip>
  ))}</div>;
  const chip = <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold", chipTone[w.tone])}>{w.text}</span>;
  const btn = <NextButton c={c} busy={busy} failed={failed} onUse={onUse} onAuthorise={onAuthorise} onView={onView} />;
  return (
    <tr onClick={onOpen} className="cursor-pointer border-t border-border align-middle hover:bg-muted/30 max-md:block max-md:px-4 max-md:py-3">
      <td className="px-4 py-3 max-md:hidden" onClick={(e) => e.stopPropagation()}><Checkbox aria-label={`Select ${c.name}`} checked={checked} onCheckedChange={(v) => onCheck(!!v)} /></td>
      <td className="px-3 py-3 max-md:block max-md:p-0">
        <div className="flex items-center gap-2">
          <span className="md:hidden" onClick={(e) => e.stopPropagation()}><Checkbox aria-label={`Select ${c.name}`} checked={checked} onCheckedChange={(v) => onCheck(!!v)} /></span>
          <div className="min-w-0 flex-1"><div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.ref ?? "—"} · {noOrders(c) ? "No orders yet" : plural(c.orders.length, "order")}</div></div>
          <span className="md:hidden">{chip}</span>
        </div>
      </td>
      <td className="px-3 py-3 max-md:block max-md:p-0 max-md:pt-2">{tags}</td>
      <td className="px-3 py-3 max-md:block max-md:p-0 max-md:pt-2"><DbdText c={c} busy={busy} failed={failed} onRefresh={onRefresh} /></td>
      <td className="whitespace-nowrap px-3 py-3 max-md:hidden">{dm(c.latestPaid)}</td>
      <td className="px-3 py-3 max-md:hidden">{chip}</td>
      <td className="px-3 py-3 text-right max-md:block max-md:p-0 max-md:pt-2 max-md:text-left">{btn}</td>
    </tr>
  );
}

const STEPS = ["Paid", "DBD data", "Ready", "Authorised", "Shared"];
function Tracker({ o, data }: { o: PaidOrder; data: boolean }) {
  const done = [true, data, data && o.status !== "paid", o.status === "delivered", o.shares > 0];
  const cur = done.indexOf(false);
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
      {STEPS.map((s, i) => (
        <li key={s} className={cn("rounded-full px-2 py-0.5 font-semibold", done[i] ? "bg-[#DCFCE7] text-[#166534]" : i === cur ? "bg-[#FEF3C7] text-[#92400E]" : "bg-muted text-muted-foreground")}>
          {done[i] ? "✓ " : ""}{s}{i === 4 ? ` · ${o.shares}` : ""}
        </li>
      ))}
    </ol>
  );
}

function SidePanel({ c, prices, busy, failed, onUse, onViewData, onRefresh, onDelete, onAuthorise, onView, onChanged }: {
  c: PaidCompany; prices: Prices; busy?: string; failed?: string; onUse: () => void; onViewData: () => void; onRefresh: (link?: boolean) => void; onDelete: () => void;
  onAuthorise: (o: PaidOrder) => void; onView: (k?: HubKey) => void; onChanged: () => void;
}) {
  const w = waitingChip(c);
  const data = hasData(c);
  const notOrdered = PAID_ORDER.filter((k) => !c.orders.some((o) => o.key === k) && data && (noOrders(c) || k === "credit" || c.produced.includes(k)));
  const link = "inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline";
  return (
    <div>
      <div className="border-b border-border px-5 py-4 pr-12">
        <SheetTitle className="text-lg">{c.name}</SheetTitle>
        <p className="text-xs text-muted-foreground">{c.ref ?? "—"} · Reg. no. {c.reg ?? "—"} · {plural(c.orders.length, "paid report")}</p>
        <div className="mt-2 flex items-center gap-3"><span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", chipTone[w.tone])}>{w.text}</span><button type="button" className={link} onClick={() => onView()}>Open reports</button></div>
      </div>
      <div className="space-y-3 p-5">
        <div className="rounded-xl bg-muted/50 p-3.5 text-[13px]">
          {busy ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{busy}</p>
            : c.dbd.state === "stored" ? (
              <div className="space-y-2">
                <p><b>DBD data already stored</b> · Found under Reg. no. {c.reg}, extracted {dmy(c.dbd.at)}{c.dbd.usedBy.length ? ` for ${c.dbd.usedBy.join(", ")}` : ""}. No new fetch needed.</p>
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" className={link} onClick={onViewData}>View data</button>
                  <button type="button" className={link} onClick={() => onRefresh(true)}><RefreshCw className="h-[15px] w-[15px]" />Refresh from DBD instead</button>
                  <Button size="sm" className="ml-auto h-8 bg-foreground text-background hover:bg-foreground/90" onClick={onUse}>Use stored data</Button>
                </div>
              </div>
            ) : c.dbd.state === "linked" ? (
              <div className="space-y-2">
                <p><b>{c.dbd.how === "linked" ? `DBD data linked ${dmy(c.dbd.at)}` : c.dbd.how === "refreshed" ? `DBD data refreshed ${dmy(c.dbd.at)}` : c.dbd.how === "manual" ? `DBD data entered by hand ${dmy(c.dbd.at)}` : `DBD data extracted ${dmy(c.dbd.at)}`}</b>
                  {" · "}{c.dbd.how === "linked" ? "Reused from the store, not fetched again" : c.dbd.how === "refreshed" ? "Fetched again from DBD · read-only · used by every report" : "Read-only · used by every report"}</p>
                {failed && <p className="text-destructive">{failed}</p>}
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" className={link} onClick={onViewData}>View data</button>
                  <button type="button" className={link} onClick={() => onRefresh()}><RefreshCw className="h-[15px] w-[15px]" />Refresh from DBD</button>
                  <button type="button" className={cn(link, "text-destructive")} onClick={onDelete}><Trash2 className="h-[15px] w-[15px]" />Delete DBD data</button>
                </div>
              </div>
            ) : (
              <div>
                {failed && <p className="mb-2 text-destructive">{failed}</p>}
                <DbdStorePanel reg={c.reg} onChanged={onChanged} />
              </div>
            )}
        </div>

        {noOrders(c) && <section className="space-y-2 py-2">
          <h3 className="font-semibold">No reports ordered yet</h3>
          <p className="text-sm text-muted-foreground">All 7 reports are ready from the stored DBD data. Open them to check them now. When the company orders one, it shows here with <strong>Authorise seller</strong>.</p>
          {c.awaitingUserApproval && <p className="text-sm text-muted-foreground">Waiting in User approval › Sellers.</p>}
        </section>}

        {c.orders.map((o) => (
          <div key={o.id + o.key} className="rounded-xl border border-border p-3.5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{PAID_NAMES[o.key]}</div>
                <div className="text-xs text-muted-foreground">{o.ref} · {baht(o.amount ?? prices[o.key])} · Marked paid {dm(o.paidAt)} · {o.method ?? "Manual"}</div>
                {data && o.status !== "paid" ? <button type="button" className="mt-1 text-[13px] font-semibold text-primary hover:underline" onClick={() => onView(o.key)}>View report</button>
                  : <div className="mt-1 text-xs text-muted-foreground">Report not made yet</div>}
              </div>
              {o.status === "delivered" ? (
                <Link to="/my-reports" search={{ company: c.startupId, report: o.key } as never} className="text-[13px] font-semibold text-primary hover:underline">{o.shares ? "Manage sharing" : "Share with buyers"}</Link>
              ) : data && o.status === "generated" ? (
                <Button size="sm" className="h-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onAuthorise(o)}>Authorise seller</Button>
              ) : (
                <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Button size="sm" disabled className="h-8">Authorise seller</Button></span></TooltipTrigger><TooltipContent>{data ? "The report isn't made yet" : "Extract DBD data first"}</TooltipContent></Tooltip>
              )}
            </div>
            <Tracker o={o} data={data} />
          </div>
        ))}

        {notOrdered.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{noOrders(c) ? "Ready from this data:" : "Also ready from this data, not ordered:"}</p>
            <div className="flex flex-wrap gap-1.5">{notOrdered.map((k) => <Button key={k} variant="secondary" type="button" onClick={() => onView(k)} className="h-auto rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">{PAID_NAMES[k]}</Button>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewDataDialog({ reg, company, onClose }: { reg: string; company: PaidCompany; onClose: () => void }) {
  const fn = useServerFn(viewStoredDbd);
  const q = useQuery({ queryKey: ["dbd-store", "view", reg], queryFn: () => fn({ data: { reg } }) });
  const v = q.data;
  const s = company.dbd;
  const line = s.state === "stored" ? `Stored for ${s.usedBy.filter((x) => x !== company.ref).join(", ") || "another record"} · not linked to this company yet`
    : s.how === "linked" ? "Linked from the store" : s.how === "refreshed" ? "Refreshed from DBD" : s.how === "manual" ? "Entered by hand" : "Extracted from DBD";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Stored DBD data · {company.name}</DialogTitle>
        {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : !v ? <p className="text-sm text-muted-foreground">Nothing is stored for this registration number.</p> : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{line} · {dmy(v.retrievedAt)} · read-only</p>
            <table className="w-full"><tbody>{v.rows.map(([k, val]) => <tr key={k} className="border-t border-border"><td className="py-1.5 pr-3 text-muted-foreground">{k}</td><td className="py-1.5">{val}</td></tr>)}</tbody></table>
            <p className="text-muted-foreground">Used by {v.usedBy.join(", ") || "—"}</p>
          </div>
        )}
        <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmBox({ confirm, onClose, onGo }: { confirm: Confirm | null; onClose: () => void; onGo: (c: Confirm) => void }) {
  let title = "", body = "", go = "";
  if (confirm?.kind === "authorise") {
    const orders = [...new Map(confirm.companies.flatMap((c) => readyOrders(c).map((o) => [o.id, o] as const))).values()];
    if (confirm.companies.length > 1) {
      title = `Authorise ${orders.length} reports for ${confirm.companies.length} companies?`;
      body = "Each seller will see their reports in My reports and can share them with buyers. Companies still without DBD data are skipped.";
      go = `Authorise ${orders.length} reports`;
    } else {
      const c = confirm.companies[0];
      title = `Authorise ${c.name}?`;
      const names = readyOrders(c).map((o) => PAID_NAMES[o.key]);
      body = orders.length === 1 ? `${c.name} will see the ${names[0]} (${orders[0].ref}) in My reports and can share it with buyers.`
        : `${c.name} will see ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} in My reports and can share them with buyers.`;
      go = orders.length === 1 ? "Authorise seller" : `Authorise ${orders.length} reports`;
    }
  } else if (confirm?.kind === "refresh") {
    const c = confirm.companies[0];
    if (confirm.companies.length > 1) {
      title = `Fetch DBD data again for ${confirm.companies.length} companies?`;
      body = "The stored data will be replaced for each company, and its reports rebuilt from the new data. Authorised reports stay authorised, and sellers and buyers see the new figures.";
    } else if (confirm.link) {
      title = `Fetch ${c.name}'s data from DBD again?`;
      body = `The stored data from ${dmy(c.dbd.at)}${c.dbd.usedBy.length ? ` (also used by ${c.dbd.usedBy.join(", ")})` : ""} will be replaced for Reg. no. ${c.reg}, and every report built from it will be rebuilt.`;
    } else {
      title = `Fetch ${c.name}'s data from DBD again?`;
      body = `The stored data from ${dmy(c.dbd.at)} will be replaced, and the reports will be rebuilt from the new data. Authorised reports stay authorised, and the seller and buyers see the new figures.`;
    }
    go = "Refresh";
  } else if (confirm?.kind === "delete") {
    title = `Delete ${confirm.company.name}'s DBD data?`;
    body = `The stored data for Reg. no. ${confirm.company.reg} is removed for every company that uses it. Reports not yet authorised need the data again.`;
    go = "Delete DBD data";
  }
  return (
    <AlertDialog open={!!confirm} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{body}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={confirm?.kind === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : confirm?.kind === "authorise" ? "bg-accent text-accent-foreground hover:bg-accent/90" : undefined} onClick={() => confirm && onGo(confirm)}>{go}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

