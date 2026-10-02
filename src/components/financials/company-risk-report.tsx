import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Download, Info } from "lucide-react";
import { getStartupFinancials } from "@/lib/financials.functions";
import { FINANCIALS_STALE_TIME, financialsQueryKey } from "@/hooks/use-has-financials";
import { HatSkeleton } from "@/components/ui/PitchSnackLoader";
import { buildRiskReport, LEVELS, SAFE, mBaht, pct, x, type Level } from "@/lib/company-risk";
import { cn } from "@/lib/utils";

const TABS = [
  { k: "sum", label: "Summary" }, { k: "liq", label: "Liquidity" }, { k: "debt", label: "Debt" }, { k: "stress", label: "Stress test" },
] as const;
type Tab = (typeof TABS)[number]["k"];

const LEVEL_TONE: Record<Level, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Guarded: "bg-lime-50 text-lime-700 border-lime-200",
  Moderate: "bg-amber-50 text-amber-700 border-amber-200",
  Elevated: "bg-orange-50 text-orange-700 border-orange-200",
  High: "bg-red-50 text-red-700 border-red-200",
};
const SHORT = "#eb6834", LONG = "#2a78d6";

function LevelPill({ l }: { l: Level | null }) {
  if (!l) return <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">Not enough data</span>;
  return <span className={cn("rounded-full border px-2 py-0.5 text-[11.5px] font-semibold", LEVEL_TONE[l])}>{l}</span>;
}

function Card({ title, sub, children, className }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[13px] border border-[#E5E7EB] bg-white p-5", className)}>
      {title && <div className="text-[15px] font-semibold text-[#111827]">{title}</div>}
      {sub && <div className="mb-3 text-[12.5px] text-[#6B7280]">{sub}</div>}
      {children}
    </div>
  );
}

function Tile({ label, value, ok, safe }: { label: string; value: string; ok: boolean | null; safe: string }) {
  return (
    <div className="rounded-[11px] border border-[#E5E7EB] bg-white p-4">
      <div className="text-[12px] text-[#6B7280]">{label}</div>
      <div className="mt-1 text-[22px] font-bold text-[#111827]">{value}</div>
      <div className={cn("mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium", ok == null ? "text-[#9CA3AF]" : ok ? "text-[#15803D]" : "text-[#B45309]")}>
        {ok == null ? <Info className="h-3 w-3" /> : ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        Safe {safe}
      </div>
    </div>
  );
}

export function CompanyRiskReport({ startupId }: { startupId: string }) {
  const fetchFin = useServerFn(getStartupFinancials);
  const { data, isLoading } = useQuery({ queryKey: financialsQueryKey(startupId), queryFn: () => fetchFin({ data: { startupId } }), staleTime: FINANCIALS_STALE_TIME });
  const [tab, setTab] = useState<Tab>("sum");
  if (isLoading || !data) return <HatSkeleton lines={5} headMessage="Loading company risk…" delay={0} />;
  const r = buildRiskReport(data);
  const L = r.latest;
  const name = data.legalNameEn || data.legalNameTh || data.registeredName || data.startupName;
  if (!L) return <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center text-sm text-muted-foreground">No filed statements yet, so the risk report cannot be built.</div>;
  const maxLiab = Math.max(...r.years.map((y) => (y.currentLiab ?? 0) + (y.nonCurrentLiab ?? 0)), 1);
  const maxCover = Math.max(...r.stress.map((s) => s.cover ?? 0), SAFE.cover, 1);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-[25px] font-bold tracking-[-0.015em] text-[#122B54]">Company Risk</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Juristic Name : {name} · liquidity and debt · FY{r.year}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0F1B33]">
          <Download className="h-[15px] w-[15px] text-muted-foreground" />Download PDF
        </button>
      </div>

      <div role="tablist" className="flex gap-5 border-b border-[#E5E7EB]">
        {TABS.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={cn("-mb-px border-b-2 pb-2.5 text-[13.5px] font-semibold", tab === t.k ? "border-[#F59E0B] text-[#111827]" : "border-transparent text-[#6B7280] hover:text-[#111827]")}>{t.label}</button>
        ))}
      </div>

      {tab === "sum" && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[260px] flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[.07em] text-[#9CA3AF]">Overall rating</div>
                <div className="mt-1 text-[28px] font-bold text-[#111827]">{r.level ?? "—"}{r.score != null && <span className="ml-2 text-[16px] font-medium text-[#6B7280]">{r.score}/100</span>}</div>
                <div className="mt-3 flex gap-1">
                  {LEVELS.map((l) => (
                    <div key={l} className="flex-1">
                      <div className={cn("h-2 rounded-full", l === r.level ? "bg-[#111827]" : "bg-[#E5E7EB]")} />
                      <div className={cn("mt-1 text-[11px]", l === r.level ? "font-semibold text-[#111827]" : "text-[#9CA3AF]")}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <dl className="grid min-w-[240px] grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
                <dt className="text-[#6B7280]">Current assets less short-term liabilities</dt><dd className="text-right font-semibold">{mBaht(L.workingCapital)}</dd>
                <dt className="text-[#6B7280]">Due within 12 months</dt><dd className="text-right font-semibold">{mBaht(L.currentLiab)}</dd>
                <dt className="text-[#6B7280]">Due after 12 months</dt><dd className="text-right font-semibold">{mBaht(L.nonCurrentLiab)}</dd>
                <dt className="text-[#6B7280]">Equity</dt><dd className="text-right font-semibold">{mBaht(L.equity)}</dd>
              </dl>
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            {r.pillars.map((p) => (
              <Card key={p.key}>
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-[#374151]">{p.label}</span><LevelPill l={p.level} /></div>
                <div className="mt-2 text-[18px] font-bold text-[#111827]">{p.value}</div>
                <div className="mt-1 text-[12.5px] text-[#6B7280]">{p.note}</div>
              </Card>
            ))}
          </div>
          <Card title="Questions buyers will ask">
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13.5px] text-[#374151]">{r.questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </Card>
          <Card title="Summary" sub="Written automatically from the filed figures.">
            <div className="space-y-2.5 text-[13.5px] leading-relaxed text-[#374151]">
              {r.summary.map((s) => <p key={s.title}><b className="text-[#111827]">{s.title}.</b> {s.text}</p>)}
            </div>
          </Card>
        </div>
      )}

      {tab === "liq" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Tile label="Current ratio" value={x(L.current)} ok={L.current == null ? null : L.current >= SAFE.current} safe={`above ${SAFE.current}×`} />
            <Tile label="Quick ratio (without stock)" value={x(L.quick)} ok={L.quick == null ? null : L.quick >= SAFE.quick} safe={`above ${SAFE.quick}×`} />
            <Tile label="Working capital" value={mBaht(L.workingCapital)} ok={L.workingCapital == null ? null : L.workingCapital >= 0} safe="above ฿0" />
          </div>
          <TrendTable r={r} rows={[["Current ratio", (y) => x(y.current)], ["Quick ratio", (y) => x(y.quick)], ["Working capital", (y) => mBaht(y.workingCapital)]]} />
        </div>
      )}

      {tab === "debt" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Tile label="Due within 12 months" value={pct(L.shortShare)} ok={L.shortShare == null ? null : L.shortShare <= SAFE.shortShare} safe={`below ${pct(SAFE.shortShare)}`} />
            <Tile label="Liabilities to equity" value={x(L.de)} ok={L.de == null ? null : L.de <= SAFE.de} safe={`below ${SAFE.de}×`} />
            <Tile label="Interest cover" value={x(L.cover, 1)} ok={L.cover == null ? null : L.cover >= SAFE.cover} safe={`above ${SAFE.cover}×`} />
            <Tile label="Total liabilities" value={mBaht((L.currentLiab ?? 0) + (L.nonCurrentLiab ?? 0))} ok={null} safe="—" />
          </div>
          <Card title="Short-term against long-term liabilities" sub="Share due within 12 months, each filed year.">
            <div className="flex h-[200px] items-end gap-4 pt-4">
              {r.years.map((y) => {
                const s = y.currentLiab ?? 0, l = y.nonCurrentLiab ?? 0;
                return (
                  <div key={y.year} className="flex flex-1 flex-col items-center gap-1" title={`FY${y.year}: short-term ${mBaht(s)}, long-term ${mBaht(l)}`}>
                    <span className="text-[11.5px] font-semibold text-[#374151]">{pct(y.shortShare)}</span>
                    <div className="flex w-full max-w-[48px] flex-col justify-end gap-[2px]" style={{ height: 150 }}>
                      <div className="rounded-t-[4px]" style={{ height: (l / maxLiab) * 150, background: LONG }} />
                      <div style={{ height: (s / maxLiab) * 150, background: SHORT }} />
                    </div>
                    <span className="text-[11.5px] text-[#6B7280]">FY{String(y.year).slice(-2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-4 text-[12px] text-[#6B7280]">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: SHORT }} />Due within 12 months</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: LONG }} />Due later</span>
            </div>
          </Card>
          <TrendTable r={r} rows={[["Due within 12 months", (y) => mBaht(y.currentLiab)], ["Due later", (y) => mBaht(y.nonCurrentLiab)], ["Share short-term", (y) => pct(y.shortShare)], ["Liabilities to equity", (y) => x(y.de)], ["Interest cover", (y) => x(y.cover, 1)]]} />
        </div>
      )}

      {tab === "stress" && (
        <Card title="Interest cover under stress" sub={`Operating profit divided by interest cost, FY${r.year}. Safe above ${SAFE.cover}×.`}>
          <div className="mt-3 space-y-3">
            {r.stress.map((s) => (
              <div key={s.label} className="grid grid-cols-[180px_1fr_60px] items-center gap-3 text-[13px]">
                <span className="text-[#374151]">{s.label}</span>
                <div className="relative h-6 rounded bg-[#F3F4F6]">
                  <div className="h-6 rounded" style={{ width: `${Math.max(0, ((s.cover ?? 0) / maxCover) * 100)}%`, background: (s.cover ?? 0) >= SAFE.cover ? LONG : "#e34948" }} />
                  <div className="absolute inset-y-0 border-l border-dashed border-[#111827]" style={{ left: `${(SAFE.cover / maxCover) * 100}%` }} />
                </div>
                <span className="text-right font-semibold">{x(s.cover, 1)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[12px] text-[#6B7280]">
        <b className="text-[#374151]">Built from DBD filings only.</b> {r.gaps.join(" ")}
      </div>
    </div>
  );
}

function TrendTable({ r, rows }: { r: ReturnType<typeof buildRiskReport>; rows: [string, (y: ReturnType<typeof buildRiskReport>["years"][number]) => string][] }) {
  const ys = r.years.slice(-5);
  return (
    <Card title="Five-year trend">
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-[13px]">
          <thead><tr className="border-b border-[#F0F1F4] text-[#6B7280]"><th className="py-2 text-left font-medium" />{ys.map((y) => <th key={y.year} className="py-2 text-right font-medium">FY{y.year}</th>)}</tr></thead>
          <tbody>{rows.map(([label, f]) => (
            <tr key={label} className="border-b border-[#F0F1F4] last:border-0"><td className="py-2 text-[#374151]">{label}</td>{ys.map((y) => <td key={y.year} className="py-2 text-right font-medium">{f(y)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}
