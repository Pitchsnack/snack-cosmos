import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Download, FileText, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip as TT, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
const Tooltip = ({ children }: { children: React.ReactNode }) => <TooltipProvider delayDuration={200}><TT>{children}</TT></TooltipProvider>;
import { cn } from "@/lib/utils";
import { STEPS, currentStep } from "@/lib/pipeline-state";
import type { SampleReportData } from "@/lib/sample-report";
import {
  getPipelineReport, compareReports, investorProfile, sellerProfile, decideLoi,
  type PipelineRow, type ReportData,
} from "@/lib/pipeline.functions";

/* ---------------- helpers ---------------- */
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
export const shortDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep") : "—");
function mn(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const x = v / 1e6;
  const t = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return x < 0 ? `(${t})` : t;
}
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v < 0 ? "(" : ""}${Math.abs(v).toFixed(1)}%${v < 0 ? ")" : ""}`);
function money(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1e9) return `฿${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `฿${+(n / 1e6).toFixed(1)}M`;
  return `฿${n.toLocaleString()}`;
}

function metrics(r: ReportData, y: number) {
  const g = (m: Record<string, Record<number, number | null>>, ...codes: string[]) => {
    for (const c of codes) { const v = m[c]?.[y]; if (v != null) return v; }
    return null;
  };
  const revenue = g(r.income, "total_revenue", "revenue_sales_services");
  const gross = g(r.income, "gross_profit_loss");
  const pbt = g(r.income, "profit_loss_before_income_tax");
  const interest = g(r.income, "interest_expenses");
  const ebitda = pbt != null ? pbt + Math.abs(interest ?? 0) : null;
  const net = g(r.income, "net_profit_loss");
  return {
    revenue, gross, ebitda, net,
    assets: g(r.position, "total_assets"), liabilities: g(r.position, "total_liabilities"), equity: g(r.position, "equity"),
    cash: null as number | null, debt: null as number | null,
  };
}
const margin = (a: number | null, b: number | null) => (a != null && b ? (a / b) * 100 : null);

/* ---------------- shell ---------------- */
function Shell({ width, onClose, children, label }: { width: number; onClose: () => void; children: React.ReactNode; label: string }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-label={label}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ maxWidth: width }}
        className="flex max-h-[calc(100vh-64px)] w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[16px] border-0 bg-white p-0 font-['DM_Sans',system-ui,sans-serif] text-[#111827] shadow-[0_30px_70px_rgba(16,24,40,.28)] sm:rounded-[16px] [&>button:last-child]:hidden"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
function CloseX({ onClose }: { onClose: () => void }) {
  return (
    <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]">
      <X className="h-4 w-4" />
    </button>
  );
}
function Tile30({ name }: { name: string }) {
  const i = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-[14px] font-bold text-white">{i}</div>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">{children}</div>;
}
function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-[#F0F1F4] py-2 text-[13px]">
          <div className="text-[#6B7280]">{k}</div><div className="text-[#111827]">{v ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}
function DownloadBtn({ allowed, reason }: { allowed: boolean; reason?: string }) {
  const b = (
    <Button variant="outline" size="sm" disabled={!allowed} onClick={() => window.print()} className="h-8 gap-1.5">
      <Download className="h-3.5 w-3.5" />Download PDF
    </Button>
  );
  if (allowed) return b;
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{b}</span></TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip>;
}

/* ---------------- report viewer ---------------- */
export function ReportViewer({ p: pRow, seller, viewerName, onClose, sample, initialTab = "fin" }: { p?: PipelineRow; seller: boolean; viewerName?: string | null; onClose: () => void; sample?: SampleReportData; initialTab?: "fin" | "val" }) {
  const f = useServerFn(getPipelineReport);
  const qc = useQueryClient();
  const p = pRow as PipelineRow;
  const q = useQuery({
    queryKey: ["pipeline", "report", pRow?.id ?? "sample"],
    enabled: !sample && !!pRow,
    queryFn: async () => { const r = await f({ data: { id: p.id } }); if (!seller) qc.invalidateQueries({ queryKey: ["pipeline"], exact: false, predicate: (q) => q.queryKey[1] !== "report" }); return r; },
    staleTime: 0,
  });
  const data = sample?.data ?? q.data;
  const isLoading = !sample && q.isLoading;
  const error = sample ? null : q.error;
  const [tab, setTab] = useState<"fin" | "val">(initialTab);
  const [allRatios, setAllRatios] = useState(false);
  const [valTab, setValTab] = useState<"summary" | "methods" | "adjustments" | "peers">("summary");

  const company = sample ? sample.company : p.parties.sellerCompany;
  const cashOf = (y: number) => sample?.cash[y] ?? null;
  const debtOf = (y: number) => sample?.debt[y] ?? null;
  const years = data?.years ?? [];
  const last = years[years.length - 1];
  const prev = years[years.length - 2];
  const m = data && last ? metrics(data, last) : null;
  const mp = data && prev ? metrics(data, prev) : null;
  const growth = m?.revenue != null && mp?.revenue ? ((m.revenue - mp.revenue) / Math.abs(mp.revenue)) * 100 : null;
  const today = shortDate(new Date().toISOString());
  const mark = sample ? "Sample · made-up figures · not a real company" : seller ? `Shared with ${p.parties.buyerOrg} · confidential` : `${p.parties.buyerOrg} · ${viewerName ?? p.parties.buyerName ?? "Viewer"} · ${today} · confidential`;
  const yl = (y: number) => `FY${String(y).slice(-2)}`;

  return (
    <Shell width={920} onClose={onClose} label="Financial report">
      <div className="flex items-start gap-3 border-b border-[#F0F1F4] px-6 pb-3 pt-5">
        <Tile30 name={company} />
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-[17px] font-bold">{sample ? `Sample report · ${company}` : seller ? `Your report · ${company}` : company}</DialogTitle>
          <DialogDescription className="text-[12.5px] text-[#6B7280]">
            {sample ? `${sample.sector} · anonymised preview · ` : ""}Verified financial report{years.length ? ` · FY${years[0]}–${last}` : ""} · ฿ million
          </DialogDescription>
        </div>
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#ECFDF3] px-2.5 text-[12px] font-semibold text-[#15803D]"><BadgeCheck className="h-3.5 w-3.5" />Verified by PitchSnack</span>
        <DownloadBtn allowed={!sample && (seller || p.reportAllowDownload)} reason={sample ? "Download is available once your own report is delivered" : "The seller has not allowed downloads for this report"} />
        <CloseX onClose={onClose} />
      </div>
      <div className="px-6 pt-4">
        <div role="tablist" onKeyDown={tabArrowNav} className="inline-flex gap-1 rounded-[10px] border border-[#E3E8F0] bg-[#F1F4F9] p-[5px]">
          {([["fin", "Financial report"], ["val", "Estimated valuation"]] as const).map(([k, l]) => {
            const off = k === "val" && !data?.valuationShared;
            const on = tab === k;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} aria-disabled={off || undefined} disabled={off} tabIndex={on ? 0 : -1}
                onClick={() => !off && setTab(k)}
                className={cn("flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[7px] px-[14px] text-[13px] font-medium",
                  on ? "bg-[#F6A823] text-[#0E162F] shadow-[0_1px_2px_rgba(15,23,42,.10)] ring-1 ring-[#DD971F]"
                    : off ? "cursor-not-allowed text-[#A0A7B4]" : "text-[#5B6576] hover:bg-[#E6EBF3] hover:text-[#0F1B33]")}>
                {l}{off && <span className="rounded-full bg-[#E7EBF2] px-[7px] py-px text-[10px] font-semibold text-[#6A7181]">not shared</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 grid h-[150%] w-[150%] -rotate-[24deg] grid-cols-3 content-start gap-x-10 gap-y-16 pt-10">
            {Array.from({ length: 60 }).map((_, i) => <span key={i} className="whitespace-nowrap text-[13px] font-semibold text-[rgba(17,24,39,.06)]">{mark}</span>)}
          </div>
        </div>
        <div className="relative">
          {isLoading && <div className="py-16 text-center text-[#6B7280]">Loading report…</div>}
          {error && <div className="py-16 text-center text-[#6B7280]">{(error as Error).message}</div>}
          {data && !years.length && <div className="py-16 text-center text-[#6B7280]">The verified figures have not been published for this business yet.</div>}
          {data && years.length > 0 && tab === "fin" && m && (
            <>
              <div className="sticky top-0 z-10 -mx-6 mb-1 border-b border-[#EAECEF] bg-white px-6 pb-[14px] pt-[10px]">
                <div role="tablist" onKeyDown={tabArrowNav} className="inline-flex gap-0.5 rounded-[9px] border border-[#DCE3EF] bg-white p-[3px]">
                  {([["overview", "Overview"], ["info", "Company Info"], ["statements", "Financial Statements"], ["ratios", "Financial Ratios"]] as const).map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={finTab === k} tabIndex={finTab === k ? 0 : -1} onClick={() => setFinTab(k)}
                      className={cn("h-[30px] whitespace-nowrap rounded-[6px] px-3 text-[12.5px] font-medium", finTab === k ? "bg-[#F6A823] text-[#0E162F] shadow-[inset_0_0_0_1px_#DD971F]" : "text-[#5B6576] hover:bg-[#F1F4F9]")}>{l}</button>
                  ))}
                </div>
              </div>
              {finTab === "overview" && (<>
              <Caption>Key finance summary · FY{last}</Caption>
              <div className="grid grid-cols-4 gap-3">
                {([
                  ["Revenue", mn(m.revenue), growth != null ? `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs FY${String(prev).slice(-2)}` : "—"],
                  ["EBITDA", mn(m.ebitda), `${pct(margin(m.ebitda, m.revenue))} margin`],
                  ["Net profit", mn(m.net), `${pct(margin(m.net, m.revenue))} margin`],
                  sample ? ["Net debt/(cash)", mn((debtOf(last) ?? 0) - (cashOf(last) ?? 0)), "Interest-bearing debt less cash"] : ["Net debt/(cash)", "—", "Not in the filed statements"],
                ] as const).map(([k, v, s]) => (
                  <div key={k} className="rounded-[12px] border border-[#E5E7EB] bg-white/80 p-3">
                    <div className="text-[12px] text-[#6B7280]">{k}</div>
                    <div className="mt-1 text-[20px] font-bold tabular-nums">{v}</div>
                    <div className="text-[11.5px] text-[#6B7280]">{s}</div>
                  </div>
                ))}
              </div>
              </>)}
              {finTab === "info" && (<>
              <Caption>Company info</Caption>
              <div className="grid grid-cols-2 gap-x-6">
                <Rows rows={[...(sample ? [["Company name", sample.legalName] as [string, string]] : []), ["Registration no.", data.info.registration], ["Registered capital", data.info.capital != null ? `฿${data.info.capital.toLocaleString()}` : null], ["Founded", data.info.founded]]} />
                <Rows rows={[["Employees", data.info.employees], ["Directors", data.info.directors], ["Shareholders", data.info.shareholders]]} />
              </div>
              </>)}
              {finTab === "statements" && (<>
              <Caption>Income statement · ฿ million</Caption>
              <FigTable years={years} yl={yl} rows={[
                ["Revenue", (y) => metrics(data, y).revenue, null],
                ["Gross profit", (y) => metrics(data, y).gross, (y) => margin(metrics(data, y).gross, metrics(data, y).revenue)],
                ["EBITDA", (y) => metrics(data, y).ebitda, (y) => margin(metrics(data, y).ebitda, metrics(data, y).revenue)],
                ["Net profit", (y) => metrics(data, y).net, (y) => margin(metrics(data, y).net, metrics(data, y).revenue)],
              ]} />
              <Caption>Balance sheet · ฿ million</Caption>
              <FigTable years={years} yl={yl} rows={[
                ["Total assets", (y) => metrics(data, y).assets, null],
                ["Cash", cashOf, null],
                ["Interest-bearing debt", debtOf, null],
                ["Total liabilities", (y) => metrics(data, y).liabilities, null],
                ["Equity", (y) => metrics(data, y).equity, null],
              ]} />
              </>)}
              {finTab === "ratios" && (<>
              <Caption>Financial ratios · FY{last}</Caption>
              <div className="grid grid-cols-4 gap-3">
                {(allRatios ? data.ratios : data.ratios.slice(0, 8)).map((r) => (
                  <div key={r.code} className="rounded-[12px] border border-[#E5E7EB] bg-white/80 p-3">
                    <div className="line-clamp-2 text-[11.5px] text-[#6B7280]">{r.label.replace(/\s*\((%|times)\)/, "")}</div>
                    <div className="mt-1 text-[16px] font-bold tabular-nums">{r.value == null ? "—" : r.unit === "percent" ? pct(r.value) : `${r.value.toFixed(2)}×`}</div>
                  </div>
                ))}
              </div>
              {data.ratios.length > 8 && (
                <div className="mt-2 text-[12px] text-[#6B7280]">
                  Showing {allRatios ? data.ratios.length : 8} of {data.ratios.length} ratios ·{" "}
                  <button className="font-semibold text-[#2563EB]" onClick={() => setAllRatios(!allRatios)}>{allRatios ? "Show fewer" : "Show all"}</button>
                </div>
              )}
              <Caption>Analyst notes</Caption>
              {sample ? (
                <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#374151]">
                  <li>Revenue grew every year with steady gross margins; growth driven by new customers and higher order values.</li>
                  <li>One-off costs shown below EBITDA · related-party rent restated at market rate.</li>
                  <li>This is a sample with made-up figures. Your report uses your own DBD filings.</li>
                </ul>
              ) : <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#374151]">
                <li>EBITDA shown as profit before tax plus interest; depreciation is not split out in the filed statements.</li>
                <li>Cash and interest-bearing debt are not reported separately in the DBD filing.</li>
              </ul>}
              <p className="mt-2 text-[12px] text-[#6B7280]">Sources: DBD filings FY{years[0]}–{last} · audited statements · checked by PitchSnack analysts.</p>
            </>
          )}
          {sample && tab === "val" && (() => {
            const v = sample.valuation;
            const lastEbitda = last ? metrics(sample.data, last).ebitda : null;
            const lastRev = last ? metrics(sample.data, last).revenue : null;
            const med = (k: "growth" | "ebitdaMargin" | "netMargin" | "evEbitda") => {
              const a = v.peers.map((p2) => p2[k]).sort((x, y) => x - y);
              return a[Math.floor(a.length / 2)]!;
            };
            return (
              <>
                <div className="sticky top-0 z-10 -mx-6 mb-1 border-b border-[#EAECEF] bg-white px-6 pb-[14px] pt-[10px]">
                  <div role="tablist" onKeyDown={tabArrowNav} className="inline-flex gap-0.5 rounded-[9px] border border-[#DCE3EF] bg-white p-[3px]">
                    {([["summary", "Summary"], ["methods", "Methods"], ["adjustments", "Earnings adjustments"], ["peers", "Peer benchmarking"]] as const).map(([k, l]) => (
                      <button key={k} type="button" role="tab" aria-selected={valTab === k} tabIndex={valTab === k ? 0 : -1} onClick={() => setValTab(k)}
                        className={cn("h-[30px] whitespace-nowrap rounded-[6px] px-3 text-[12.5px] font-medium", valTab === k ? "bg-[#F6A823] text-[#0E162F] shadow-[inset_0_0_0_1px_#DD971F]" : "text-[#5B6576] hover:bg-[#F1F4F9]")}>{l}</button>
                    ))}
                  </div>
                </div>


                {valTab === "summary" && (
                  <>
                    <Caption>Valuation range · equity value</Caption>
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white/80 p-4">
                      <div className="grid grid-cols-3 text-center">
                        {([["Low", v.low], ["Midpoint", v.mid], ["High", v.high]] as const).map(([k, x]) => (
                          <div key={k}><div className="text-[12px] text-[#6B7280]">{k}</div><div className={cn("mt-1 text-[20px] font-bold tabular-nums", k === "Midpoint" && "text-[#B45309]")}>{mn(x)}M</div></div>
                        ))}
                      </div>
                      <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-[#E5E7EB] via-[#FDE68A] to-[#E5E7EB]">
                        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#F59E0B] shadow" />
                      </div>
                      {lastEbitda ? <div className="mt-2 text-center text-[12px] text-[#6B7280]">Midpoint ÷ FY{String(last).slice(-2)} normalised EBITDA = {(v.mid / v.normalisedEbitda).toFixed(1)}×</div> : null}
                    </div>

                    <Caption>Headline multiples · company vs listed peers</Caption>
                    <table className="w-full text-[13px] tabular-nums">
                      <thead><tr className="text-[11.5px] text-[#6B7280]">
                        <th className="py-1.5 text-left font-medium">Metric</th><th className="py-1.5 text-right font-medium">This business</th>
                        <th className="py-1.5 text-right font-medium">Peer low</th><th className="py-1.5 text-right font-medium">Peer median</th>
                        <th className="py-1.5 text-right font-medium">Peer high</th><th className="py-1.5 text-right font-medium">Implied value</th>
                      </tr></thead>
                      <tbody>{v.multiples.map((r) => (
                        <tr key={r.metric} className="border-t border-[#F0F1F4]">
                          <td className="py-2 font-medium">{r.metric}</td>
                          <td className="py-2 text-right font-semibold text-[#B45309]">{r.company}</td>
                          <td className="py-2 text-right text-[#6B7280]">{r.peerLow}</td>
                          <td className="py-2 text-right">{r.peerMedian}</td>
                          <td className="py-2 text-right text-[#6B7280]">{r.peerHigh}</td>
                          <td className="py-2 text-right">{r.implied}</td>
                        </tr>
                      ))}</tbody>
                    </table>

                    <Caption>From enterprise value to equity value</Caption>
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white/80">
                      {v.bridge.map((b) => (
                        <div key={b.label} className={cn("flex items-center justify-between border-b border-[#F0F1F4] px-4 py-2.5 text-[13px] last:border-0", b.kind === "total" && "bg-[#FAFAFB] font-semibold")}>
                          <span className={b.kind === "total" ? "text-[#111827]" : "text-[#6B7280]"}>{b.label}</span>
                          <span className={cn("tabular-nums", b.value < 0 && "text-[#B91C1C]")}>{mn(b.value)}M</span>
                        </div>
                      ))}
                    </div>

                    <Caption>Discounts and premiums applied</Caption>
                    <div className="grid grid-cols-2 gap-3">
                      {v.discounts.map((d) => (
                        <div key={d.label} className="rounded-[12px] border border-[#E5E7EB] bg-white/80 p-3">
                          <div className="flex items-baseline justify-between">
                            <div className="text-[12.5px] font-medium">{d.label}</div>
                            <div className={cn("text-[15px] font-bold tabular-nums", d.pct < 0 ? "text-[#15803D]" : "text-[#B45309]")}>{d.pct < 0 ? "+" : "−"}{Math.abs(d.pct)}%</div>
                          </div>
                          <div className="mt-1 text-[11.5px] text-[#6B7280]">{d.note}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {valTab === "methods" && (
                  <>
                    <Caption>Methods and weighting</Caption>
                    <table className="w-full text-[13px]">
                      <thead><tr className="text-[11.5px] text-[#6B7280]">
                        <th className="py-1.5 text-left font-medium">Method</th><th className="py-1.5 text-left font-medium">Basis</th>
                        <th className="py-1.5 text-left font-medium">Multiple / rate</th><th className="py-1.5 text-right font-medium">Value</th>
                        <th className="py-1.5 text-right font-medium">Weight</th><th className="py-1.5 text-right font-medium">Confidence</th>
                      </tr></thead>
                      <tbody>{v.methods.map((m2) => (
                        <tr key={m2.method} className="border-t border-[#F0F1F4]">
                          <td className="py-2 font-medium">{m2.method}</td><td className="py-2 text-[#6B7280]">{m2.basis}</td>
                          <td className="py-2">{m2.rate}</td><td className="py-2 text-right tabular-nums">{m2.value}</td>
                          <td className="py-2 text-right tabular-nums">{m2.weight}</td>
                          <td className="py-2 text-right"><span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", m2.confidence === "High" ? "bg-[#ECFDF3] text-[#15803D]" : m2.confidence === "Medium" ? "bg-[#FFFBEB] text-[#B45309]" : "bg-[#F3F4F6] text-[#6B7280]")}>{m2.confidence}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <Caption>How the range is built</Caption>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#374151]">
                      <li>Each method is valued on normalised EBITDA of {mn(v.normalisedEbitda)}M, then weighted as shown above.</li>
                      <li>Enterprise value of {mn(v.ev)}M is bridged to equity value by deducting debt and adding cash.</li>
                      <li>The low and high points sit at −16% and +17% of the midpoint, reflecting deal outcome spread.</li>
                    </ul>
                  </>
                )}

                {valTab === "adjustments" && (
                  <>
                    <Caption>Reported to normalised EBITDA · FY{String(last).slice(-2)}</Caption>
                    <div className="rounded-[12px] border border-[#E5E7EB] bg-white/80">
                      <div className="flex items-center justify-between border-b border-[#F0F1F4] px-4 py-2.5 text-[13px]">
                        <span className="text-[#6B7280]">Reported EBITDA</span><span className="tabular-nums font-semibold">{mn(v.reportedEbitda)}M</span>
                      </div>
                      {v.earnings.map((a) => (
                        <div key={a.label} className="flex items-start justify-between gap-4 border-b border-[#F0F1F4] px-4 py-2.5 text-[13px]">
                          <span><span className="font-medium">{a.label}</span><span className="block text-[11.5px] text-[#6B7280]">{a.note}</span></span>
                          <span className={cn("tabular-nums", a.amount < 0 ? "text-[#B91C1C]" : "text-[#15803D]")}>{a.amount < 0 ? "" : "+"}{mn(a.amount)}M</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between bg-[#FAFAFB] px-4 py-2.5 text-[13px] font-semibold">
                        <span>Normalised EBITDA</span><span className="tabular-nums text-[#B45309]">{mn(v.normalisedEbitda)}M</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-[#6B7280]">
                      Normalised margin {lastRev ? pct((v.normalisedEbitda / lastRev) * 100) : "—"} against reported {lastRev ? pct((v.reportedEbitda / lastRev) * 100) : "—"}.
                      Adjustments move earnings to what a buyer would inherit.
                    </p>
                  </>
                )}

                {valTab === "peers" && (
                  <>
                    <Caption>Listed peer set · FY{String(last).slice(-2)}</Caption>
                    <table className="w-full text-[13px] tabular-nums">
                      <thead><tr className="text-[11.5px] text-[#6B7280]">
                        <th className="py-1.5 text-left font-medium">Company</th><th className="py-1.5 text-right font-medium">Revenue</th>
                        <th className="py-1.5 text-right font-medium">Growth</th><th className="py-1.5 text-right font-medium">EBITDA margin</th>
                        <th className="py-1.5 text-right font-medium">Net margin</th><th className="py-1.5 text-right font-medium">EV / EBITDA</th>
                      </tr></thead>
                      <tbody>
                        {v.peers.map((p2) => (
                          <tr key={p2.name} className="border-t border-[#F0F1F4]">
                            <td className="py-2 font-medium">{p2.name}</td><td className="py-2 text-right">{mn(p2.revenue)}M</td>
                            <td className="py-2 text-right">{pct(p2.growth)}</td><td className="py-2 text-right">{pct(p2.ebitdaMargin)}</td>
                            <td className="py-2 text-right">{pct(p2.netMargin)}</td><td className="py-2 text-right">{p2.evEbitda.toFixed(1)}×</td>
                          </tr>
                        ))}
                        <tr className="border-t border-[#E5E7EB] bg-[#FAFAFB] font-semibold">
                          <td className="py-2">Peer median</td><td className="py-2 text-right">—</td>
                          <td className="py-2 text-right">{pct(med("growth"))}</td><td className="py-2 text-right">{pct(med("ebitdaMargin"))}</td>
                          <td className="py-2 text-right">{pct(med("netMargin"))}</td><td className="py-2 text-right">{med("evEbitda").toFixed(1)}×</td>
                        </tr>
                        <tr className="border-t border-[#E5E7EB] font-semibold text-[#B45309]">
                          <td className="py-2">This business</td><td className="py-2 text-right">{mn(lastRev)}M</td>
                          <td className="py-2 text-right">{growth != null ? pct(growth) : "—"}</td>
                          <td className="py-2 text-right">{lastRev ? pct((v.normalisedEbitda / lastRev) * 100) : "—"}</td>
                          <td className="py-2 text-right">{last ? pct(margin(metrics(sample.data, last).net, lastRev)) : "—"}</td>
                          <td className="py-2 text-right">{(v.ev / v.normalisedEbitda).toFixed(1)}×</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="mt-2 text-[12px] text-[#6B7280]">Peers are matched on sector and business model, then screened for size and profitability.</p>
                  </>
                )}

                <div className="mt-4 space-y-1 border-t border-[#F0F1F4] pt-3 text-[12px] text-[#6B7280]">
                  {v.notes.map((n) => <p key={n}>{n}</p>)}
                  <p>Sample with made-up figures.</p>
                </div>
              </>
            );
          })()}

          {!sample && data && tab === "val" && (
            <div className="py-10 text-[13px] text-[#374151]">
              <p>The estimated valuation for this business is delivered by PitchSnack analysts.</p>
              <p className="mt-2 text-[#6B7280]">The asking price remains the seller's. This range is an independent estimate by PitchSnack analysts.</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[#F0F1F4] bg-[#FAFAFB] px-6 py-3 text-[12.5px] text-[#6B7280]">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {sample
          ? "Sample report with a made-up company and figures. Your own report is prepared from your DBD filings."
          : seller
          ? `This is what ${p.parties.buyerOrg} sees. You shared it on ${fmtDate(p.reportSharedAt)} · ${p.reportViewedAt ? `they last opened it on ${fmtDate(p.reportViewedAt)}` : "they have not opened it yet"}.`
          : `Shared with you by ${company} on ${fmtDate(p.reportSharedAt)} under the NDA. Confidential: the seller can see when you open this report.`}
      </div>
    </Shell>
  );
}

function FigTable({ years, yl, rows }: { years: number[]; yl: (y: number) => string; rows: [string, (y: number) => number | null, ((y: number) => number | null) | null][] }) {
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead><tr className="text-[11.5px] text-[#6B7280]"><th className="py-1.5 text-left font-medium" />{years.map((y) => <th key={y} className="py-1.5 text-right font-medium">{yl(y)}</th>)}</tr></thead>
      <tbody>
        {rows.map(([label, v, mg]) => (
          <tr key={label} className="border-t border-[#F0F1F4]">
            <td className="py-2 text-[#374151]">{label}</td>
            {years.map((y) => (
              <td key={y} className="py-2 text-right">{mn(v(y))}{mg && <span className="ml-1 text-[11px] text-[#9CA3AF]">{pct(mg(y))}</span>}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- compare ---------------- */
export function CompareReports({ rows, onOpen, onClose }: { rows: PipelineRow[]; onOpen: (p: PipelineRow) => void; onClose: () => void }) {
  const f = useServerFn(compareReports);
  const { data = {} } = useQuery({ queryKey: ["pipeline", "compare"], queryFn: () => f() });
  const list = rows.filter((p) => p.reportSharedAt);
  const val = (p: PipelineRow, fn: (r: ReportData, y: number, py?: number, y0?: number) => React.ReactNode) => {
    const r = (data as Record<string, ReportData>)[p.id];
    if (!r || !r.years.length) return "—";
    const ys = r.years; return fn(r, ys[ys.length - 1], ys[ys.length - 2], ys[Math.max(0, ys.length - 4)]);
  };
  const lines: [string, (p: PipelineRow) => React.ReactNode][] = [
    ["Revenue FY25", (p) => val(p, (r, y) => mn(metrics(r, y).revenue))],
    ["Revenue growth FY25", (p) => val(p, (r, y, py) => { const a = metrics(r, y).revenue, b = py ? metrics(r, py).revenue : null; return a != null && b ? pct(((a - b) / Math.abs(b)) * 100) : "—"; })],
    ["Revenue CAGR FY22–25", (p) => val(p, (r, y, _p, y0) => { const a = metrics(r, y).revenue, b = y0 != null ? metrics(r, y0).revenue : null; const n = y0 != null ? y - y0 : 0; return a && b && n > 0 && a > 0 && b > 0 ? pct((Math.pow(a / b, 1 / n) - 1) * 100) : "—"; })],
    ["EBITDA FY25", (p) => val(p, (r, y) => mn(metrics(r, y).ebitda))],
    ["EBITDA margin", (p) => val(p, (r, y) => pct(margin(metrics(r, y).ebitda, metrics(r, y).revenue)))],
    ["Net profit FY25", (p) => val(p, (r, y) => mn(metrics(r, y).net))],
    ["Net debt / (cash)", () => "—"],
    ["Estimated valuation", (p) => ((data as Record<string, ReportData>)[p.id]?.valuationShared ? "Shared" : <span className="text-[#9CA3AF]">Not shared</span>)],
    ["Midpoint ÷ EBITDA", (p) => ((data as Record<string, ReportData>)[p.id]?.valuationShared ? "—" : <span className="text-[#9CA3AF]">Not shared</span>)],
    ["Pipeline step", (p) => STEPS[Math.min(currentStep(p), 6)]],
    ["Report received", (p) => fmtDate(p.reportSharedAt)],
  ];
  return (
    <Shell width={920} onClose={onClose} label="Compare reports">
      <div className="flex items-start gap-3 border-b border-[#F0F1F4] px-6 pb-4 pt-5">
        <div className="flex-1">
          <DialogTitle className="text-[17px] font-bold">Compare reports</DialogTitle>
          <DialogDescription className="text-[12.5px] text-[#6B7280]">{list.length} businesses whose seller shared the verified report · FY2025 · ฿ million</DialogDescription>
        </div>
        <CloseX onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-4">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr>
              <th className="w-[190px]" />
              {list.map((p) => (
                <th key={p.id} className="py-3 text-right align-bottom font-normal">
                  <div className="flex flex-col items-end gap-1">
                    <div className="[&>div]:!h-[30px] [&>div]:!w-[30px] [&>div]:!text-[11px]"><Tile30 name={p.counterparty.name} /></div>
                    <span className="font-semibold">{p.counterparty.name}</span>
                    <button className="text-[12px] font-semibold text-[#2563EB]" onClick={() => onOpen(p)}>View report</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(([k, fn]) => (
              <tr key={k} className="border-t border-[#F0F1F4]">
                <td className="py-2 text-[#6B7280]">{k}</td>
                {list.map((p) => <td key={p.id} className="py-2 text-right">{fn(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-[#6B7280]">Only businesses whose seller shared the verified report are listed. Figures come from the reports as delivered and are not editable.</p>
      </div>
    </Shell>
  );
}

/* ---------------- investor profile ---------------- */
export function InvestorProfile({ p, onClose, onNda, onLoi }: { p: PipelineRow; onClose: () => void; onNda: () => void; onLoi: () => void }) {
  const f = useServerFn(investorProfile);
  const { data } = useQuery({ queryKey: ["pipeline", "investor", p.id], queryFn: () => f({ data: { id: p.id } }) });
  const link = "font-semibold text-[#2563EB]";
  return (
    <Shell width={520} onClose={onClose} label="Investor profile">
      <div className="flex items-start gap-3 px-6 pb-2 pt-5">
        <Tile30 name={data?.org ?? p.counterparty.name} />
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[17px] font-bold">{data?.org ?? p.counterparty.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6B7280]">
            {[data?.type, data?.city].filter(Boolean).join(" · ") || "Buyer"}
            {data?.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11.5px] font-semibold text-[#15803D]">✓ Verified buyer</span>}
          </DialogDescription>
        </div>
        <CloseX onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {data?.about && <p className="text-[13px] text-[#374151]">{data.about}</p>}
        <Caption>Investment mandate</Caption>
        <Rows rows={[["Ticket size", null], ["Sectors", data?.sectors], ["Deal type", null], ["Fund size", null], ["Track record", data?.trackRecord]]} />
        <Caption>Contact</Caption>
        <Rows rows={[
          ["Person", data?.person ? [data.person.name, data.person.role].filter(Boolean).join(" · ") : null],
          ["Details", <Link to="/marketplace/my-contact" className={link}>Open in Contacts</Link>],
        ]} />
        <Caption>This deal</Caption>
        <Rows rows={[
          ["NDA", <>{fmtDate(p.ndaApprovedAt)} · approved by you · <button className={link} onClick={onNda}>View NDA</button></>],
          ["Letter of intent", p.loiSentAt ? <>{p.loiAcceptedAt ? `accepted ${fmtDate(p.loiAcceptedAt)}` : `received ${fmtDate(p.loiSentAt)}`} · <button className={link} onClick={onLoi}>View LOI</button></> : "Not received"],
          ["Financial report", p.reportSharedAt ? `shared ${fmtDate(p.reportSharedAt)}${p.reportViewedAt ? ` · viewed ${fmtDate(p.reportViewedAt)}` : ""}` : "not shared"],
          ["Current step", STEPS[Math.min(currentStep(p), 6)]],
        ]} />
      </div>
    </Shell>
  );
}

/* ---------------- NDA & LOI ---------------- */
function DocHead({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#F0F1F4] px-6 pb-4 pt-5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#F3F4F6] text-[#4B5563]"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <DialogTitle className="text-[17px] font-bold">{title}</DialogTitle>
        <DialogDescription className="text-[12.5px] text-[#6B7280]">{sub}</DialogDescription>
      </div>
      <DownloadBtn allowed />
      <CloseX onClose={onClose} />
    </div>
  );
}
function Reader({ label, text, onRead }: { label: string; text: string; onRead?: () => void }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const check = () => {
    const el = ref.current; if (!el || done) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) { setDone(true); onRead?.(); }
  };
  return (
    <div className="mt-4">
      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { setOpen(!open); setTimeout(check, 30); }}>
        <FileText className="h-3.5 w-3.5" />{open ? `Hide the full ${label}` : `Read the full ${label}`}
      </Button>
      {open && (
        <>
          <div ref={ref} onScroll={check} className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-[#E5E7EB] bg-[#FCFCFD] p-4 text-[13px] leading-[1.6] text-[#374151]">{text}</div>
          <div className={cn("mt-1.5 text-[12px]", done ? "font-semibold text-[#15803D]" : "text-[#6B7280]")}>{done ? "✓ Read to the end" : "Scroll to the end of the text."}</div>
        </>
      )}
    </div>
  );
}
function Foot({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 border-t border-[#F0F1F4] bg-[#FAFAFB] px-6 py-3 text-[12.5px] text-[#6B7280]">{children}</div>;
}
function StatusPill({ tone, children }: { tone: "green" | "amber"; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold", tone === "green" ? "bg-[#ECFDF3] text-[#15803D]" : "bg-[#FFFBEB] text-[#B45309]")}>{children}</span>;
}

function ndaText(p: PipelineRow) {
  return `MUTUAL NON-DISCLOSURE AGREEMENT

Between ${p.parties.sellerCompany}${p.parties.codeName ? ` (listed as ${p.parties.codeName})` : ""} ("the Seller") and ${p.parties.buyerOrg} ("the Buyer"), arranged through PitchSnack.

1. Purpose. The Buyer receives confidential information only to evaluate a possible acquisition of or investment in the Seller.

2. Confidential information. All information shared through PitchSnack after this NDA is approved, including the company identity, financial reports, contacts and documents, is confidential.

3. Use. The Buyer uses the information only to evaluate this deal and shares it only with advisers bound by the same duty of confidence.

4. No direct contact. The Buyer does not contact the Seller's staff, customers or suppliers without the Seller's written consent.

5. Non-solicitation. For 12 months the Buyer does not solicit the Seller's employees or customers.

6. Term. This agreement runs for 2 years from approval, until ${fmtDate(p.ndaExpiresAt)}.

7. Return of information. On request, the Buyer deletes or returns all confidential information.

8. Governing law. This agreement is governed by the laws of Thailand.

Requested by the Buyer on ${fmtDate(p.ndaRequestedAt)}. Approved by the Seller on ${fmtDate(p.ndaApprovedAt)}.

— End of agreement —`;
}
function loiText(p: PipelineRow) {
  return `LETTER OF INTENT

From ${p.parties.buyerOrg} to ${p.parties.sellerCompany}, sent ${fmtDate(p.loiSentAt)}.

1. Proposed transaction. The Buyer proposes to acquire ${p.loiStakePct != null ? `${p.loiStakePct}% of` : "an interest in"} the Seller for an indicative price of ${money(p.loiAmount)}.

2. Consideration. Cash at completion, subject to due diligence and final agreement.

3. Due diligence. Financial, legal and commercial review through the PitchSnack data room.

4. Conditions. ${p.loiConditions || "No further conditions stated."}

5. Exclusivity. From acceptance the Seller grants the Buyer ${p.loiExclusivityDays ?? 0} days of exclusivity, during which it does not negotiate with other buyers.

6. Binding effect. This letter is non-binding, except for exclusivity and confidentiality.

7. Confidentiality. This letter and its contents are confidential under the NDA between the parties.

— End of letter —`;
}

export function NdaDialog({ p, seller, onClose }: { p: PipelineRow; seller: boolean; onClose: () => void }) {
  return (
    <Shell width={640} onClose={onClose} label="Mutual NDA">
      <DocHead title="Mutual NDA" sub={`With ${seller ? p.parties.buyerOrg : p.parties.sellerCompany}`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <StatusPill tone="green">✓ Active until {fmtDate(p.ndaExpiresAt)}</StatusPill>
        <Caption>Parties</Caption>
        <Rows rows={[["Seller", `${p.parties.sellerCompany}${p.parties.codeName ? ` (${p.parties.codeName})` : ""}`], ["Buyer", p.parties.buyerOrg]]} />
        <Caption>Signatures</Caption>
        <Rows rows={[
          ["Signed by the buyer", [p.parties.buyerName, fmtDate(p.ndaRequestedAt), "e-signature"].filter(Boolean).join(" · ")],
          ["Approved by the seller", [p.parties.sellerName, fmtDate(p.ndaApprovedAt)].filter(Boolean).join(" · ")],
          ["Term", `2 years · until ${fmtDate(p.ndaExpiresAt)}`],
        ]} />
        <Caption>Key terms</Caption>
        <Rows rows={[["Use of information", "Only to evaluate this deal"], ["Contact", "No direct contact with staff, customers or suppliers"], ["Non-solicitation", "12 months"], ["Governing law", "Thailand"]]} />
        <Reader label="NDA" text={ndaText(p)} />
      </div>
      <Foot><Lock className="h-3.5 w-3.5" />Both parties hold the same signed copy. Stored by PitchSnack.</Foot>
    </Shell>
  );
}

export function LoiDialog({ p, seller, onClose }: { p: PipelineRow; seller: boolean; onClose: () => void }) {
  const deciding = seller && !!p.loiSentAt && !p.loiAcceptedAt;
  const [read, setRead] = useState(false);
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = useServerFn(decideLoi);
  const qc = useQueryClient();
  const days = p.loiExclusivityDays ?? 0;
  const consent = `I have read the letter of intent and accept its terms on behalf of ${p.parties.sellerCompany}. I understand that exclusivity starts today and runs for ${days} days.`;
  const run = async (decision: "accept" | "decline" | "changes") => {
    setBusy(true);
    try {
      await f({ data: { id: p.id, decision, consent: decision === "accept" ? consent : undefined } });
      toast.success(decision === "accept" ? "Letter of intent accepted · exclusivity started today" : decision === "changes" ? "Changes requested" : "Letter of intent declined");
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const status = p.loiAcceptedAt
    ? <StatusPill tone="green">✓ Accepted {fmtDate(p.loiAcceptedAt)}</StatusPill>
    : <StatusPill tone="amber">{seller ? "Waiting for your review" : "Waiting for the seller"}</StatusPill>;
  return (
    <Shell width={640} onClose={onClose} label="Letter of intent">
      <DocHead title="Letter of intent" sub={`${seller ? `From ${p.parties.buyerOrg}` : `To ${p.parties.sellerCompany}`} · sent ${fmtDate(p.loiSentAt)}`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {status}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {([["Price", money(p.loiAmount)], ["Stake", p.loiStakePct != null ? `${p.loiStakePct}%` : "—"], ["Exclusivity", `${days} days`]] as const).map(([k, v]) => (
            <div key={k} className="rounded-[12px] border border-[#E5E7EB] p-3"><div className="text-[12px] text-[#6B7280]">{k}</div><div className="mt-0.5 text-[17px] font-bold">{v}</div></div>
          ))}
        </div>
        <Caption>Terms</Caption>
        <Rows rows={[
          ["Consideration", "Cash at completion"],
          ["Due diligence", "Financial, legal and commercial"],
          ["Conditions", p.loiConditions || "—"],
          ["Timeline", `${days} days exclusivity from acceptance`],
          ["Offer valid until", null],
          ["Binding", "Non-binding, except exclusivity and confidentiality"],
        ]} />
        <Caption>Signed</Caption>
        <Rows rows={[
          ["By the buyer", [p.parties.buyerName, fmtDate(p.loiSentAt), "e-signature"].filter(Boolean).join(" · ")],
          ["Seller decision", p.loiAcceptedAt ? `Accepted by ${p.loiAcceptedByName ?? "the seller"} · ${fmtDate(p.loiAcceptedAt)}` : "Not decided yet"],
        ]} />
        <Reader label="letter of intent" text={loiText(p)} onRead={() => setRead(true)} />
        {deciding && (
          <label className={cn("mt-4 flex items-start gap-3 rounded-[12px] border border-[#E5E7EB] px-[14px] py-3 text-[13px]", !read && "bg-[#FAFAFB] text-[#9CA3AF]")}>
            <input type="checkbox" disabled={!read} checked={tick} onChange={(e) => setTick(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#111827]" />
            <span>
              {consent}
              <span className="mt-1 block text-[12px] text-[#6B7280]">{read ? "You have read the full letter." : "Open and read the full letter to the end to tick this box."}</span>
            </span>
          </label>
        )}
      </div>
      {deciding ? (
        <div className="flex items-center gap-2 border-t border-[#F0F1F4] bg-[#FAFAFB] px-6 py-3">
          <span className="flex-1 text-[12.5px] text-[#6B7280]">Accepting starts {days} days of exclusivity.</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run("decline")}>Decline</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run("changes")}>Request changes</Button>
          {tick ? (
            <Button size="sm" disabled={busy} onClick={() => run("accept")}>Accept LOI</Button>
          ) : (
            <Tooltip><TooltipTrigger asChild><span tabIndex={0}><Button size="sm" disabled>Accept LOI</Button></span></TooltipTrigger><TooltipContent>Tick the box to accept</TooltipContent></Tooltip>
          )}
        </div>
      ) : (
        <Foot><Lock className="h-3.5 w-3.5" />Confidential under the NDA. Both parties see the same letter.</Foot>
      )}
    </Shell>
  );
}

/* ---------------- Seller profile (buyer) ---------------- */
export function SellerProfile({ p, onClose, onNda, onLoi, onReport, onAsk }: { p: PipelineRow; onClose: () => void; onNda: () => void; onLoi: () => void; onReport: () => void; onAsk: () => void }) {
  const f = useServerFn(sellerProfile);
  const { data } = useQuery({ queryKey: ["pipeline", "seller", p.id], queryFn: () => f({ data: { id: p.id } }) });
  const link = "font-semibold text-[#2563EB] hover:underline";
  const name = data?.name ?? p.counterparty.name;
  const logo = p.counterparty.logoUrl;
  return (
    <Shell width={520} onClose={onClose} label="Seller profile">
      <div className="flex items-start gap-3 border-b border-[#F0F1F4] px-6 pb-4 pt-5">
        {logo ? <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-[11px] border border-[#E5E7EB] object-contain" /> : <div className="[&>div]:!h-11 [&>div]:!w-11 [&>div]:!rounded-[11px]"><Tile30 name={name} /></div>}
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[18px] font-bold">{name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6B7280]">
            {[data?.industry, data?.city].filter(Boolean).join(" · ") || "Seller"}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11.5px] font-semibold text-[#15803D]">✓ Verified seller</span>
          </DialogDescription>
        </div>
        <CloseX onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {data?.about && <p className="text-[13.5px] text-[#374151]">{data.about}</p>}
        <Caption>The deal</Caption>
        <Rows rows={[["Asking price", data?.askingPrice != null ? money(data.askingPrice) : null], ["Stake for sale", data?.stakePct != null ? `${data.stakePct}%` : null], ["Deal type", data?.dealType], ["Reason for sale", data?.reason]]} />
        <Caption>Company</Caption>
        <Rows rows={[["Code name", data?.codeName], ["Founded", data?.founded], ["Employees", data?.employees],
          ["Website", data?.website ? <a href={/^https?:/.test(data.website) ? data.website : `https://${data.website}`} target="_blank" rel="noreferrer" className={link}>{data.website.replace(/^https?:\/\//, "")}</a> : null]]} />
        <Caption>Contact</Caption>
        <Rows rows={[
          ["Person", data?.person ? [data.person.name, data.person.role].filter(Boolean).join(" · ") : null],
          ["Details", <Link to="/marketplace/my-contact" className={link}>Open in Contacts</Link>],
        ]} />
        <Caption>This deal</Caption>
        <Rows rows={[
          ["NDA", <>{fmtDate(p.ndaApprovedAt)} · approved by the seller · <button className={link} onClick={onNda}>View NDA</button></>],
          ["Financial report", p.reportSharedAt ? <>received {fmtDate(p.reportSharedAt)} · <button className={link} onClick={onReport}>View report</button></>
            : p.reportRequestedAt ? `requested ${fmtDate(p.reportRequestedAt)} · waiting for the seller`
            : <>not received · <button className={link} onClick={onAsk}>Ask for it</button></>],
          ...(p.loiSentAt ? [["Letter of intent", <>{p.loiAcceptedAt ? `accepted ${fmtDate(p.loiAcceptedAt)}` : `sent ${fmtDate(p.loiSentAt)} · waiting for the seller`} · <button className={link} onClick={onLoi}>View LOI</button></>] as [string, React.ReactNode]] : []),
          ["Current step", STEPS[Math.min(currentStep(p), 6)]],
        ]} />
        <Button asChild variant="outline" size="sm" className="mt-5 h-8">
          <Link to="/marketplace/browse" search={{ company: p.hiddenProfileId }}>Open full listing ›</Link>
        </Button>
      </div>
    </Shell>
  );
}

/** Left/right arrow keys move between the enabled tabs of a tablist. */
function tabArrowNav(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
  const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  if (next) { e.preventDefault(); next.focus(); next.click(); }
}
