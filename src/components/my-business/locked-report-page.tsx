import { useMemo, useState } from "react";
import { Check, Eye, Lock } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createMyReportOrder } from "@/lib/report-orders.functions";
import { dayMonth, useStartupReportOrders, type ReportOrder } from "@/components/reports/report-order-bits";
import { Button } from "@/components/ui/button";
import { useStartups } from "@/hooks/use-startups";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";
import { selectMyStartups } from "@/lib/publication/my-startups-membership";
import { reportPrice } from "@/components/my-business/report-offers";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { useHasFinancials } from "@/hooks/use-has-financials";
import catalog from "@/config/report-catalog.json";
import { ReportViewer } from "@/components/pipeline/pipeline-dialogs";
import { makeSampleReport } from "@/lib/sample-report";

type Kind = "financials" | "valuation";

/** Report orders are not tracked server-side yet. */
export const isReportOrdered = (_kind: Kind) => false;


export function PadlockTile() {
  return (
    <span title="Locked until you order the report" className="ml-auto grid h-5 w-5 place-items-center rounded-md bg-amber-500/20 text-amber-400" data-mkt-lock data-mkt-badge>
      <Lock className="h-3 w-3" />
    </span>
  );
}

export function PitchsnackTag() {
  return <span data-mkt-badge className="ml-auto rounded-[5px] bg-profile/25 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-profile">PitchSnack</span>;
}

const TITLES: Record<Kind, { page: string; card: string; tag: string }> = {
  financials: { page: "My Financials", card: "Unlock your verified financials", tag: "Verified financial report" },
  valuation: { page: "Company Valuation", card: "Unlock your estimated valuation", tag: "Estimated valuation" },
};

function useMyBusinesses() {
  const { data: session } = useSessionContext();
  const { roles } = usePermissions();
  const { data } = useStartups({ page: 1, pageSize: 100 });
  const raw = data && "items" in data ? data.items : [];
  const meId = session?.user?.id ?? null;
  return useMemo(() => selectMyStartups(raw, meId, roles.includes("STARTUP_USER")), [raw, meId, roles]);
}

export function LockedReportPage({ kind }: { kind: Kind }) {
  const mine = useMyBusinesses();
  const [picked, setPicked] = useState<string | null>(null);
  const [sample, setSample] = useState<Kind | null>(null);
  const [sampleData, setSampleData] = useState<ReturnType<typeof makeSampleReport> | null>(null);
  const company = mine.find((m) => m.id === picked) ?? mine[0];
  const name = company?.startup_name ?? "Your company";
  const cfg = catalog.locked[kind];
  const fill = (t: string) => t.replace("{days}", String(cfg.deliveryDays)).replace("{valuationPrice}", reportPrice("valuation"));
  const t = TITLES[kind];

  const { hasData } = useHasFinancials(company?.id ?? "");
  const { data: ordersData } = useStartupReportOrders(company?.id);
  const orders = (ordersData?.orders ?? []) as ReportOrder[];
  const orderFor = (k: Kind) => orders.find((o) => o.kind === k || o.kind === "bundle");
  const order = orderFor(kind);
  const delivered = order?.status === "delivered";
  const needsFinancials = kind === "valuation" && orderFor("financials")?.status !== "delivered";
  const qc = useQueryClient();
  const payFn = useServerFn(createMyReportOrder);
  const pay = useMutation({
    mutationFn: () => payFn({ data: { startupId: company!.id, kind } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-orders"] });
      toast.success("Order received — PitchSnack analysts will prepare your report.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const handlePay = () => { if (company) pay.mutate(); };

  const picker = mine.length > 1 && (
    <select value={company?.id} onChange={(e) => setPicked(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
      {mine.map((m) => <option key={m.id} value={m.id}>{m.startup_name}</option>)}
    </select>
  );

  if (company && delivered && hasData) {
    return (
      <div className="font-sans" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 md:px-7 md:pt-7">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">My Workspace</div>
            <h1 className="text-[26px] font-bold tracking-tight">{t.page}</h1>
            <p className="text-[13.5px] text-muted-foreground">{name} · read-only</p>
          </div>
          <div className="flex items-center gap-2">
            {picker}
            <PitchsnackTag />
          </div>
        </div>
        <StartupFinancialsPage
          id={company.id}
          workspace="my-startups"
          readOnly
          section={kind}
          {...(kind === "valuation" ? { initialTab: "valuation" } : {})}
        />
      </div>
    );
  }

  return (
    <div className="p-4 font-sans md:p-7" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">My Workspace</div>
          <h1 className="text-[26px] font-bold tracking-tight">{t.page}</h1>
          <p className="text-[13.5px] text-muted-foreground">{name} · {kind === "financials" ? "verified report" : "valuation"} {order ? "in preparation" : "not ordered yet"}</p>
        </div>
        <div className="flex items-center gap-2">
          {picker}
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11.5px] font-bold text-amber-800">{order ? `Ordered · due ${dayMonth(order.due_at)}` : "Not ordered"}</span>
        </div>
      </div>


      <div className="relative mt-4 min-h-[640px]">
        <SampleBehind />
        <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-background/20 to-background/90 px-2 pt-14">
          <div className="w-full max-w-[640px] rounded-2xl border border-profile-line bg-card p-7 shadow-2xl">
            <div className="mb-1.5 flex items-center gap-3.5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-primary-foreground shadow-lg shadow-violet-500/30"><Lock className="h-6 w-6" /></div>
              <div>
                <span className="inline-block rounded-full bg-profile-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-profile">{t.tag} · {reportPrice(kind)} one-time</span>
                <h2 className="mt-1.5 text-[22px] font-bold">{t.card}</h2>
              </div>
            </div>
            <p className="my-3 text-[13.5px] leading-relaxed text-foreground/80">
              {kind === "financials"
                ? "PitchSnack analysts prepare and verify your report straight from your DBD filings. Buyers see ranges on your listing; you release the full report to each NDA-approved buyer yourself. The report includes:"
                : "An independent valuation range for your business, built on your verified financials. You release it to each NDA-approved buyer yourself. The report includes:"}
            </p>
            <div className="mb-4 grid gap-1.5 text-[13px]">
              {cfg.items.map(([b, d]) => (
                <div key={b} className="flex items-center gap-2">
                  <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  <span><b>{fill(b)}</b>{d && <span className="text-muted-foreground"> · {fill(d)}</span>}</span>
                </div>
              ))}
            </div>
            <div className="mb-4 grid gap-1.5 text-[13px] leading-relaxed">
              <Why icon={<Eye className="h-4 w-4" />}><b>Buyers look for verified financials first.</b> When they filter the Marketplace, listings with the "Verified financials" badge are shown ahead of the rest, and buyers can shortlist without asking you for numbers.</Why>
              <Why icon={<Lock className="h-4 w-4" />}><b>You decide who sees it, every time.</b> The full report is never sent automatically. When a buyer signs the NDA, you choose whether to share it with that buyer. Buyers see only the ranges until you do. <span className="ml-1 inline-flex rounded-full border border-profile-line bg-card px-2 py-0.5 text-[11.5px] font-bold text-profile">Shared case by case</span></Why>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span title={needsFinancials ? "Your verified financial report must be delivered first" : order ? `Order ${order.ref} is being prepared` : "Pay for your report"}>
                <Button disabled={!company || needsFinancials || !!order || pay.isPending} onClick={handlePay} className="bg-sidebar text-sidebar-foreground">
                  {order ? `Ordered · ${order.ref}` : `Pay · ${reportPrice(kind)}`}
                </Button>
              </span>
              <Button variant="outline" onClick={() => { setSampleData(makeSampleReport()); setSample(kind); }}>View sample</Button>
            </div>

            <p className="mt-3 text-[11.5px] text-muted-foreground">Includes VAT · invoice issued to {name} · refundable if your DBD filings cannot be read</p>
          </div>
        </div>
      </div>
      {sample && sampleData && <ReportViewer seller sample={sampleData} initialTab={sample === "valuation" ? "val" : "fin"} onClose={() => setSample(null)} />}
    </div>
  );
}

function Why({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-profile-line bg-profile-soft px-3.5 py-2.5">
      <span className="mt-px grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border border-profile-line bg-card text-profile">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/** Blurred sample layout — always sample numbers, never the company's real figures. */
function SampleBehind() {
  const fin = catalog.sample.financials;
  const kpis = [["Revenue", "฿268.9M", "+21%"], ["Gross margin", "56%", "+1pt"], ["EBITDA", "฿40.3M", "+30%"], ["EBITDA margin", "15%", "+1pt"], ["Net profit", "฿25.0M", "+30%"], ["Net cash", "฿3.8M", ""]];
  return (
    <div aria-hidden className="pointer-events-none select-none opacity-55 blur-[4px]">
      <div className="mb-4 grid grid-cols-3 gap-2.5 lg:grid-cols-6">
        {kpis.map(([l, v, c]) => <div key={l} className="rounded-xl border border-border bg-card px-3.5 py-3"><small className="text-xs text-muted-foreground">{l}</small><b className="block text-xl">{v}</b><span className="text-xs font-semibold text-emerald-600">{c}</span></div>)}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 font-bold">Revenue</h4>
          <div className="mb-4 flex h-28 items-end gap-4 border-b border-border">{fin.chart.map((b, i) => <div key={b.year} className={`flex-1 rounded-t-md ${i === 2 ? "bg-profile" : "bg-profile/25"}`} style={{ height: `${Math.round(b.value / 268.9 * 100)}%` }} />)}</div>
          <table className="w-full text-[13px]"><tbody>{fin.rows.map((r) => <tr key={r.label} className="border-b border-border/60"><td className="py-2">{r.label}</td>{r.values.map((v, i) => <td key={i} className="text-right">{v}</td>)}</tr>)}</tbody></table>
        </div>
        <div className="space-y-3.5">
          <div className="rounded-xl border border-border bg-card p-4"><h4 className="mb-2 font-bold">Key ratios</h4>{["Current ratio 1.8", "Debt / equity 0.4", "ROE 18%", "Asset turnover 1.3"].map((x) => <div key={x} className="border-t border-border py-1.5 text-[13px]">{x}</div>)}</div>
          <div className="rounded-xl border border-border bg-card p-4"><h4 className="mb-2 font-bold">Analyst notes</h4>{fin.notes.map((n) => <p key={n.label} className="mb-2 rounded-lg bg-muted p-2.5 text-[13px]">{n.text}</p>)}</div>
        </div>
      </div>
    </div>
  );
}
