/**
 * Valuation tab — peer matching and empty states.
 *
 * Peer matching uses Sector and Business model ONLY. Industry is never
 * consulted, not even as a fallback.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CircleSlash, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-session-context";
import { getPeerMatch } from "@/lib/peer-comparables.functions";
import { peerSetLabel } from "@/lib/peer-comparables";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";

const DASH = "—";

/** A peer set older than this reads as stale. Warning only, never a block. */
const PEER_SET_STALE_DAYS = 90;
/** A filing older than this reads as stale. Warning only, never a block. */
const FILING_STALE_MONTHS = 24;

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toFixed(2)}%`;
}

function refreshAge(iso: string | null): { text: string; stale: boolean } | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const days = (Date.now() - then.getTime()) / 86_400_000;
  return {
    text: `refreshed ${formatDistanceToNow(then)} ago`,
    stale: days > PEER_SET_STALE_DAYS,
  };
}

/** Fiscal year end is taken as 31 December of that year. */
function filingIsStale(year: number | undefined): boolean {
  if (!year) return false;
  const end = new Date(Date.UTC(year, 11, 31));
  const months =
    (Date.now() - end.getTime()) / (30.436875 * 86_400_000);
  return months > FILING_STALE_MONTHS;
}

function Pill({ tone, children }: { tone: "blue" | "green"; children: React.ReactNode }) {
  const styles =
    tone === "blue"
      ? "bg-[#EFF4FE] text-[#1D4ED8] border-[#D3E0FB]"
      : "bg-[#EAF7EE] text-[#15803D] border-[#CFE8D8]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em] ${styles}`}
    >
      {children}
    </span>
  );
}

function Benchmarking({
  name,
  year,
  ratios,
  income,
  reason,
}: {
  name: string;
  year: number | undefined;
  ratios: RatioItem[];
  income: StatementItem[];
  reason: string | null;
}) {
  const ratio = (code: string) =>
    ratios.find((r) => r.ratio_code === code && r.fiscal_year === year)?.value ?? null;
  const revenueGrowth =
    income.find((i) => i.item_code === "revenue_sales_services" && i.fiscal_year === year)
      ?.percent_change ?? null;

  const rows: [string, string][] = [
    ["Gross margin", pct(ratio("gross_profit_margin"))],
    ["Net margin", pct(ratio("net_profit_margin"))],
    ["Return on equity", pct(ratio("return_on_equity"))],
    ["Revenue growth", pct(revenueGrowth)],
  ];

  return (
    <div className="mt-5 border-t border-[#EFF1F4] pt-4">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.055em] text-muted-foreground">
        <span className="h-[13px] w-[13px] rounded-[3px] bg-[#E3E8F0]" />
        From the filing
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#12294F] text-white">
              <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                Metric
              </th>
              <th className="w-[170px] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                {name}
                {year ? ` · FY${year}` : ""}
              </th>
              <th className="w-[170px] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                Peer median
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value], i) => (
              <tr key={label} className={i % 2 ? "bg-[#FAFBFD]" : undefined}>
                <td className="border-b border-[#EFF1F4] px-3 py-2">{label}</td>
                <td className="border-b border-[#EFF1F4] px-3 py-2 text-right font-bold tabular-nums text-[#0F1B33]">
                  {value}
                </td>
                <td className="border-b border-[#EFF1F4] px-3 py-2 text-right text-[#9AA3AF]">
                  {reason ?? DASH}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reason && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Figures from the filing still render. Only the comparison column waits.
        </p>
      )}
    </div>
  );
}

export function ValuationTab({
  startupId,
  startupName,
  workspace,
  year,
  ratios,
  income,
}: {
  startupId: string;
  startupName: string;
  workspace: "startups" | "my-startups";
  year: number | undefined;
  ratios: RatioItem[];
  income: StatementItem[];
}) {
  const { isControl } = usePermissions();
  const fetchMatch = useServerFn(getPeerMatch);
  const { data, isLoading } = useQuery({
    queryKey: ["peer-match", startupId],
    queryFn: () => fetchMatch({ data: { startupId } }),
  });

  const editTo =
    workspace === "my-startups" ? "/my-startups/$id/edit" : "/startups/$id/edit";
  /** Saving or cancelling the edit form comes back to this tab. */
  const editSearch = { focus: "sector", returnTo: "valuation" } as const;
  const age = data?.applied ? refreshAge(data.applied.lastRefreshedAt) : null;
  const filingStale = filingIsStale(year);

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
        Loading valuation…
      </div>
    );
  }

  return (
    <div>
      {data.state === "no-sector" && (
        <div className="rounded-xl border border-[#F6DFB4] bg-[#FEF3E7] px-6 py-7 text-center">
          <div className="mx-auto mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#FBE3C0] text-[#8A5109]">
            <Target className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-[#7C4A0B]">Sector required</h3>
          <p className="mx-auto mt-1 max-w-[48ch] text-[13px] leading-relaxed text-[#7C4A0B]">
            Add a Sector to compare this startup against listed companies. Adding a Business model
            as well narrows the comparison to companies that operate the same way — optional, but it
            gives a closer match.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <Button asChild className="h-[38px] rounded-[9px] bg-[#12294F] px-4 text-[13.5px] font-semibold hover:bg-[#12294F]/90">
              <Link to={editTo} params={{ id: startupId }} search={editSearch}>
                Add Sector
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-[38px] rounded-[9px] px-4 text-[13.5px] font-semibold text-[#1D4ED8] hover:bg-[#EFF4FE]"
            >
              <Link to={editTo} params={{ id: startupId }} search={editSearch}>
                Add both →
              </Link>
            </Button>
          </div>
          <div className="mx-auto mt-4 max-w-[420px] space-y-[7px] text-left">
            <div className="flex items-center justify-between rounded-[9px] border border-[#F0DCBC] bg-white/70 px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-[#7C4A0B]">Sector</span>
              <span className="rounded-full border border-[#F6CDCD] bg-[#FDECEC] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#B91C1C]">
                required
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[9px] border border-[#F0DCBC] bg-white/70 px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-[#7C4A0B]">Business model</span>
              <span className="text-[11.5px] text-[#8A6A12]">optional — improves the match</span>
            </div>
          </div>
        </div>
      )}

      {data.state === "no-peer-set" && (
        <>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-6 py-7 text-center">
            <div className="mx-auto mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#E7EAF0] text-[#5A6675]">
              <CircleSlash className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#0F1B33]">No peer set for {data.sector}</h3>
            <p className="mx-auto mt-1 max-w-[48ch] text-[13px] text-muted-foreground">
              Multiples are unavailable until a peer set is created for this sector.
            </p>
            {isControl && (
              <div className="mt-4">
                <Button
                  asChild
                  variant="ghost"
                  className="h-[38px] rounded-[9px] px-4 text-[13.5px] font-semibold text-[#1D4ED8] hover:bg-[#EFF4FE]"
                >
                  <Link to="/peer-comparables" search={{}}>
                    Manage peer sets →
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {(data.state === "sector-only" || data.state === "exact") && data.applied && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#12294F] text-white">
                  <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                    Peer set applied
                  </th>
                  <th className="w-[110px] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                    Peers
                  </th>
                  <th className="w-[160px] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                    {data.state === "exact" ? "Refreshed" : "Match"}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 font-bold text-[#0F1B33]">
                    {peerSetLabel(data.applied.sector, data.applied.businessModel)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{data.applied.peerCount}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {data.state === "sector-only" && <Pill tone="blue">sector only</Pill>}
                      {age ? (
                        <>
                          <span className="text-[#6B7280]">{age.text}</span>
                          {age.stale && (
                            <span className="rounded-full border border-[#F6DFB4] bg-[#FEF3E7] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309]">
                              stale
                            </span>
                          )}
                        </>
                      ) : (
                        data.state === "exact" && <span className="text-[#9AA3AF]">{DASH}</span>
                      )}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {data.state === "exact" && (
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Matched on <b>Sector + Business model</b>. Industry played no part.
            </p>
          )}

          {data.state === "sector-only" && data.narrower && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#D3E0FB] bg-[#EFF4FE] px-3.5 py-2.5 text-[12.5px] text-[#1E3A8A]">
              <span className="flex-1">
                Adding a <b>Business model</b> would narrow this to a closer peer set —{" "}
                <b>{data.narrower.label}</b> exists and holds {data.narrower.peerCount} peer
                {data.narrower.peerCount === 1 ? "" : "s"}.
              </span>
              <Button
                asChild
                variant="ghost"
                className="h-8 rounded-[9px] px-3 text-[12.5px] font-semibold text-[#1D4ED8] hover:bg-white"
              >
                <Link to={editTo} params={{ id: startupId }} search={editSearch}>
                  Add Business model
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      <Benchmarking
        name={startupName}
        year={year}
        ratios={ratios}
        income={income}
        reason={
          data.state === "no-sector"
            ? "— needs a sector"
            : data.state === "no-peer-set"
              ? "— no peer set"
              : null
        }
      />
    </div>
  );
}
