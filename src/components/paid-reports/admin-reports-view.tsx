import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getReportsHub } from "@/lib/reports-hub.functions";
import { CompanyVerificationPage } from "@/components/company-verification/page";
import { HubReport } from "@/components/reports/hub-report";
import { PAID_NAMES, PAID_ORDER, adminViewStatus, hasData, type PaidCompany, type PaidOrder } from "@/lib/paid-reports";
import type { HubKey } from "@/lib/reports-hub";
import { cn } from "@/lib/utils";

const dm = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }) : "—");
const tone = { red: "text-destructive", amber: "text-[#B45309]", green: "text-[#15803D]", grey: "text-muted-foreground" };

function firstKey(c: PaidCompany): HubKey {
  const ready = c.orders.find((o) => hasData(c) && o.status !== "paid");
  return ready?.key ?? c.orders[0]?.key ?? "statements";
}

/**
 * Admin view of a company's seven reports. The report body is the same shared
 * report the seller sees, read-only; opening it never changes its status.
 */
export function AdminReportsView({ c, initial, busy, onClose, onUse, onRefresh, onAuthorise }: {
  c: PaidCompany; initial?: HubKey; busy?: string; onClose: () => void; onUse: () => void; onRefresh: () => void; onAuthorise: (o: PaidOrder) => void;
}) {
  const [key, setKey] = useState<HubKey>(initial ?? firstKey(c));
  const hubFn = useServerFn(getReportsHub);
  const data = hasData(c);
  const hub = useQuery({ queryKey: ["reports-hub", "admin", c.startupId, undefined], queryFn: () => hubFn({ data: { mode: "admin", companyId: c.startupId } }), enabled: data });
  const o = c.orders.find((x) => x.key === key);
  const st = adminViewStatus(c, key);
  const full = !o ? (key === "credit" ? "Ready · can't be ordered yet (price not set)" : "Ready · not ordered")
    : o.status === "delivered" ? (o.shares ? `Authorised · shared with ${o.shares} buyer${o.shares === 1 ? "" : "s"}` : "Authorised · the seller can see it · not shared yet")
    : "Ready · the seller can't see it yet";
  const row = hub.data?.rows.find((r) => r.key === key);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[min(92vh,900px)] max-w-[min(1240px,calc(100vw-32px))] flex-col gap-0 p-0 max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none">
        <div className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg">{c.name}<span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-background">ADMIN VIEW</span></DialogTitle>
          <p className="text-xs text-muted-foreground">{c.ref ?? "—"} · Reg. no. {c.reg ?? "—"} · {c.orders.length} paid report{c.orders.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex min-h-0 flex-1 max-md:flex-col">
          <nav aria-label="Reports" className="w-64 shrink-0 overflow-y-auto border-r border-border p-2 max-md:flex max-md:w-full max-md:overflow-x-auto max-md:border-b max-md:border-r-0">
            {PAID_ORDER.map((k) => {
              const ko = c.orders.find((x) => x.key === k);
              const s = adminViewStatus(c, k);
              return (
                <button key={k} type="button" aria-current={k === key} onClick={() => setKey(k)}
                  className={cn("block w-full rounded-lg px-3 py-2 text-left max-md:w-52 max-md:shrink-0", k === key ? "bg-muted" : "hover:bg-muted/50")}>
                  <div className="text-[13px] font-semibold">{PAID_NAMES[k]}</div>
                  <div className="text-[11.5px] text-muted-foreground">{ko ? `${ko.ref} · Paid ${dm(ko.paidAt)}` : "Not ordered"}</div>
                  <div className={cn("text-[11.5px] font-semibold", tone[s.tone])}>{s.text}</div>
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto bg-muted/30 p-4">
            {!data || st.text === "No data yet" ? (
              <div className="mx-auto mt-10 max-w-md rounded-xl border border-border bg-card p-6 text-center">
                <h3 className="font-semibold">This report isn't made yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.dbd.state === "stored" ? "DBD data for this registration number is already stored. Link it to make every report." : data ? "This report needs analyst work before it can be viewed." : "Get the company's DBD data first. Every report is made from it."}</p>
                {!data && <Button className="mt-3" disabled={!!busy || !c.reg} onClick={onUse}>{busy ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />{busy}</> : c.dbd.state === "stored" ? "Use stored data" : "Extract data"}</Button>}
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{full}</div>
                    <div className="text-xs text-muted-foreground">Made from {c.dbd.how === "linked" ? "linked " : ""}DBD data · {dm(c.dbd.at)} · The seller sees this same page after you authorise.</div>
                  </div>
                  {o && o.status === "generated" && <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => onAuthorise(o)}>Authorise seller</Button>}
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={onRefresh}>{busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}{busy ?? "Refresh from DBD"}</Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}><Download className="mr-1 h-3.5 w-3.5" />Download PDF</Button>
                </div>
                <div className="reports-hub" data-mode="admin">
                  {key === "verification" ? <CompanyVerificationPage company={c.startupId} embedded />
                    : hub.isPending ? <p className="hub-empty">Loading report…</p>
                    : hub.data && row ? <HubReport key={`${key}-${c.dbd.at}`} hub={hub.data} row={row} />
                    : <p className="hub-empty">This report is not available yet.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
