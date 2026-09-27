import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useHasFinancials } from "@/hooks/use-has-financials";
import catalog from "@/config/report-catalog.json";

export const reportPrice = (type: keyof typeof catalog.prices) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: catalog.currency, maximumFractionDigits: 0 }).format(catalog.prices[type]);

export function ReportHeaderAction({ id }: { id: string }) {
  const { hasData } = useHasFinancials(id);
  if (hasData) return null;
  return <Button size="sm" variant="ghost" onClick={() => document.getElementById(`reports-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="h-10 gap-2 bg-transparent text-muted-foreground"><BarChart3 className="h-4 w-4" /> Add financials</Button>;
}

type Kind = "financials" | "valuation";
const offers: Record<Kind, { title: string; tag: string; description: string; benefits: string[] }> = {
  financials: {
    title: "Verified financial report", tag: "Recommended",
    description: "Your FY23–25 revenue, EBITDA and margins, prepared and verified by our analysts from your statements. Buyers see ranges before the NDA and the full report after it.",
    benefits: ["Verified financials badge on your listing", "Fewer questions, faster NDA decisions", "5 business days from your statements"],
  },
  valuation: {
    title: "Estimated valuation", tag: "Optional",
    description: "An independent valuation range for your business using comparable transactions, EV/EBITDA multiples and a cash-flow check, so buyers and you start from the same number.",
    benefits: ["Independent valuation badge on your listing", "Helps you set the asking price with confidence", "7 business days · needs the verified financials"],
  },
};

export function ReportOffers({ id }: { id: string }) {
  const navigate = useNavigate();
  const { hasData } = useHasFinancials(id);
  const [sample, setSample] = useState<Kind | null>(null);
  const enterFigures = () => navigate({ to: "/my-startups/$id/financials", params: { id } });
  return (
    <section id={`reports-${id}`} className="border-t border-border/50 pt-3 font-sans">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Financials &amp; valuation <span className="font-normal normal-case">· optional PitchSnack reports, shown to buyers after the NDA</span></h3>
      <div className="mt-3 grid gap-3 min-[900px]:grid-cols-2">
        {(["financials", "valuation"] as const).map((kind) => (
          <div key={kind} className="flex min-w-0 flex-col rounded-xl border border-profile-line bg-profile-soft/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-profile-soft px-2 py-0.5 text-[11px] font-bold uppercase text-profile">{offers[kind].tag}</span>
              <span className="font-bold">{reportPrice(kind)} <span className="text-xs font-normal text-muted-foreground">one-time</span></span>
            </div>
            <h4 className="mt-2 text-[15px] font-bold">{offers[kind].title}</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">{offers[kind].description}</p>
            <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/80">{offers[kind].benefits.map((text) => <li key={text} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{text}</li>)}</ul>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              <Button size="sm" disabled title={kind === "valuation" ? "Order the verified financial report first. Payments are not enabled yet." : "Payments are not enabled yet"} className="bg-profile text-primary-foreground">Order · {reportPrice(kind)}</Button>
              <Button size="sm" variant="outline" onClick={() => setSample(kind)}>View sample</Button>
              {kind === "financials" ? <Button size="sm" variant="link" className="ml-auto px-0 text-muted-foreground" onClick={() => void enterFigures()}>Enter figures myself</Button> : <span className="ml-auto text-xs text-muted-foreground" title="Payments are not enabled yet">Bundle both · {reportPrice("bundle")}</span>}
            </div>
          </div>
        ))}
      </div>
      {hasData && <p className="mt-2 text-xs text-muted-foreground">Existing figures: Provided by seller, not verified.</p>}
      <SampleReport kind={sample} onClose={() => setSample(null)} />
    </section>
  );
}

function SampleReport({ kind, onClose }: { kind: Kind | null; onClose: () => void }) {
  if (!kind) return null;
  const fin = catalog.sample.financials;
  const val = catalog.sample.valuation;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 font-sans sm:max-w-[720px]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5 pr-12">
          <div><span className="rounded-full bg-profile-soft px-2 py-1 text-[11px] font-bold uppercase text-profile">Sample · anonymised</span><DialogTitle className="mt-2 text-xl">{offers[kind].title}</DialogTitle><DialogDescription>{catalog.sample.company} · {kind === "financials" ? `${fin.period} · prepared ${fin.prepared}` : `based on verified FY25 financials · ${val.prepared}`}</DialogDescription></div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{kind === "financials" ? "✓ Verified by PitchSnack analysts" : "Independent · PitchSnack"}</span>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {kind === "financials" ? <>
            <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-[13px]"><thead><tr className="border-b border-border text-right text-xs uppercase text-muted-foreground"><th className="py-2 text-left">฿ million</th>{["FY23", "FY24", "FY25", "CAGR"].map((x) => <th key={x} className="px-2 py-2">{x}</th>)}</tr></thead><tbody>{fin.rows.map((r) => <tr key={r.label} className="border-b border-border/60"><td className="py-2 font-medium">{r.label}</td>{r.values.map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
            <div className="mt-6 flex h-36 items-end gap-5 border-b border-border pb-5" aria-label="Revenue FY23 184.2 million, FY24 221.6 million, FY25 268.9 million baht">{fin.chart.map((b, i) => <div key={b.year} className="relative flex h-full flex-1 flex-col justify-end text-center text-xs"><span className="font-semibold">{Math.round(b.value)}</span><div className={`mx-auto w-full max-w-28 rounded-t-md ${i === 2 ? "bg-profile" : "bg-profile/25"}`} style={{ height: `${Math.round(b.value / 268.9 * 82)}%` }} /><span className="absolute -bottom-4 inset-x-0 text-muted-foreground">{b.year}</span></div>)}</div>
          </> : <>
            <div className="mb-7 flex items-center gap-3"><div><span className="text-xs text-muted-foreground">Low</span><div className="text-lg font-bold">{val.range.low}</div></div><div className="relative h-2 flex-1 rounded-full bg-profile/25"><div className="absolute inset-0 rounded-full bg-profile/70" /><span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-profile">Midpoint {val.range.mid}</span></div><div className="text-right"><span className="text-xs text-muted-foreground">High</span><div className="text-lg font-bold">{val.range.high}</div></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-[13px]"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">{["Method", "Basis", "Multiple / rate", "Value"].map((x) => <th key={x} className="py-2 pr-2">{x}</th>)}</tr></thead><tbody>{val.rows.map((r) => <tr key={r.method} className="border-b border-border/60"><td className="py-2 pr-2 font-medium">{r.method}</td><td className="py-2 pr-2">{r.basis}</td><td className="py-2 pr-2">{r.rate}</td><td className="py-2 whitespace-nowrap text-right tabular-nums">{r.value}</td></tr>)}</tbody></table></div>
          </>}
          <dl className="mt-5 text-[12.5px] leading-relaxed">{(kind === "financials" ? fin.notes : val.notes).map((n) => <div key={n.label} className="border-t border-border py-2"><dt className="mr-2 inline font-bold">{n.label}</dt><dd className="inline text-foreground/80">{n.text}</dd></div>)}</dl>
        </div>
        <div className="flex justify-end border-t border-border px-6 py-4"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </DialogContent>
    </Dialog>
  );
}