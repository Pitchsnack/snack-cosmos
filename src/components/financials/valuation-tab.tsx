/**
 * Valuation tab — matching panel, peer matching and benchmarking.
 *
 * Peer matching uses Sector and Business model ONLY. Industry is never
 * consulted, not even as a fallback.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectorPicker, BusinessModelPicker } from "@/components/startups/sector-fields";
import { usePermissions } from "@/hooks/use-session-context";
import { getPeerMatch, getPeerSet } from "@/lib/peer-comparables.functions";
import { peerSetLabel } from "@/lib/peer-comparables";
import { businessModelLabel } from "@/lib/sectors";
import { updateStartup } from "@/lib/startups.functions";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";
import { ValuationSummary } from "@/components/financials/valuation-summary";
import { ValuationMethods } from "@/components/financials/valuation-methods";
import {
  DEFAULT_DISCOUNTS,
  computeValuation,
  readFilingInputs,
  type Discounts,
} from "@/lib/valuation";

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
  const months = (Date.now() - end.getTime()) / (30.436875 * 86_400_000);
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

function Dot({ tone }: { tone: "no" | "yes" | "warn" }) {
  const bg =
    tone === "yes" ? "bg-[#15803D]" : tone === "warn" ? "bg-[#B45309]" : "bg-[#C7CDD6]";
  return <span className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${bg}`} />;
}

function Step({ tone, children }: { tone: "no" | "yes" | "warn"; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[9px] py-[3px] text-[12.5px]">
      <Dot tone={tone} />
      <span>{children}</span>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[5px] bg-[#F3F4F6] px-[5px] py-[1px] text-[11.5px]">{children}</code>
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

/** One row of the matching panel: label, value (editable or read-only), marking. */
function MatchRow({
  label,
  marking,
  children,
}: {
  label: string;
  marking: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-[#EFF1F4] px-[15px] py-[13px] last:border-b-0">
      <span className="w-[130px] shrink-0 text-[12.5px] text-muted-foreground">{label}</span>
      <div className="min-w-[240px] flex-1">{children}</div>
      {marking}
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string | null }) {
  return (
    <span
      className={`inline-flex h-[34px] min-w-[230px] items-center rounded-[8px] border px-[11px] text-[13px] ${
        value
          ? "border-[#C7D3E6] bg-white text-[#0F1B33]"
          : "border-[#F6DFB4] bg-[#FEF3E7] font-semibold text-[#B45309]"
      }`}
    >
      {value ?? "Not set"}
    </span>
  );
}

export function ValuationTab({
  startupId,
  startupName,
  workspace,
  year,
  ratios,
  income,
  position = [],
  cashFlow = [],
}: {
  startupId: string;
  startupName: string;
  workspace: "startups" | "my-startups";
  year: number | undefined;
  ratios: RatioItem[];
  income: StatementItem[];
  position?: StatementItem[];
  cashFlow?: StatementItem[];
}) {
  const { has, isControl } = usePermissions();
  const canEdit = isControl || has("startups.write");
  const fetchMatch = useServerFn(getPeerMatch);
  const fetchPeerSet = useServerFn(getPeerSet);
  const saveStartup = useServerFn(updateStartup);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["peer-match", startupId],
    queryFn: () => fetchMatch({ data: { startupId } }),
  });

  const appliedSector = data?.applied?.sector ?? null;
  const appliedModel = data?.applied?.businessModel ?? null;
  const { data: peerSet } = useQuery({
    queryKey: ["peer-set", appliedSector, appliedModel],
    enabled: !!appliedSector,
    queryFn: () =>
      fetchPeerSet({ data: { sector: appliedSector!, businessModel: appliedModel } }),
  });

  const [subTab, setSubTab] = useState<"summary" | "methods">("summary");
  const [discounts, setDiscounts] = useState<Discounts>(DEFAULT_DISCOUNTS);
  const [sector, setSector] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);


  useEffect(() => {
    if (!data) return;
    setSector(data.sector);
    setModel(data.businessModel);
  }, [data?.sector, data?.businessModel]);

  const save = useMutation({
    mutationFn: (patch: { sector?: string | null; businessModel?: string | null }) =>
      saveStartup({ data: { id: startupId, ...patch } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["peer-match", startupId] });
      await queryClient.invalidateQueries({ queryKey: ["startup", startupId] });
      await queryClient.invalidateQueries({ queryKey: ["startup-financials", startupId] });
      toast.success("Match updated");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const age = data?.applied ? refreshAge(data.applied.lastRefreshedAt) : null;
  const filingStale = filingIsStale(year);

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
        Loading valuation…
      </div>
    );
  }

  const modelLabel = data.businessModel
    ? (businessModelLabel(data.businessModel) ?? data.businessModel)
    : null;
  const suggestion = data.narrower && data.state !== "exact" ? data.narrower : null;

  const peers = peerSet?.peers ?? [];
  const inputs = readFilingInputs(year, income, position, cashFlow, ratios);
  const result = computeValuation(inputs, peers, discounts);
  const hasPeers = !!data.applied && peers.length > 0;
  const flag = result.blocked || result.lowConfidence;


  return (
    <div>
      {/* Matching panel — shown in every state */}
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
        <div className="border-b border-[#EFF1F4] bg-[#FAFBFD] px-[15px] py-[10px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Matching on
        </div>

        <MatchRow
          label="Sector"
          marking={
            <span className="rounded-full border border-[#F6CDCD] bg-[#FDECEC] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.04em] text-[#B91C1C]">
              required
            </span>
          }
        >
          {canEdit ? (
            <SectorPicker
              value={sector}
              onChange={(v) => {
                setSector(v);
                save.mutate({ sector: v });
              }}
            />
          ) : (
            <ReadOnlyValue value={data.sector} />
          )}
        </MatchRow>

        <MatchRow
          label="Business model"
          marking={
            <span className="text-[11px] text-muted-foreground">
              optional — narrows the match
            </span>
          }
        >
          {canEdit ? (
            <BusinessModelPicker
              sector={sector}
              value={model}
              onChange={(v) => {
                setModel(v);
                save.mutate({ businessModel: v });
              }}
            />
          ) : (
            <ReadOnlyValue value={modelLabel} />
          )}
        </MatchRow>

        {/* The ladder — one line per step, with the reason */}
        <div className="border-t border-[#EFF1F4] bg-[#F7F8FA] px-[15px] py-[13px]">
          {data.state === "no-sector" ? (
            <Step tone="warn">
              <b>Result</b> — a sector is required before anything can be matched. Benchmarking
              below still works.
            </Step>
          ) : (
            <>
              <Step tone={data.state === "exact" ? "yes" : "no"}>
                <b>Sector + business model</b>{" "}
                {data.state === "exact" ? (
                  <>
                    — matched <Mono>{peerSetLabel(data.sector!, data.businessModel)}</Mono>
                  </>
                ) : data.businessModel ? (
                  <>
                    — no <Mono>{peerSetLabel(data.sector!, data.businessModel)}</Mono> set exists
                  </>
                ) : (
                  <>— no business model set, so this step is skipped</>
                )}
              </Step>

              {data.state !== "exact" && (
                <Step tone={data.state === "sector-only" ? "yes" : "no"}>
                  <b>Sector-wide set</b>{" "}
                  {data.state === "sector-only" ? (
                    <>
                      — matched <Mono>{peerSetLabel(data.sector!, null)}</Mono>
                    </>
                  ) : (
                    <>
                      — no <Mono>{peerSetLabel(data.sector!, null)}</Mono> set exists
                    </>
                  )}
                </Step>
              )}

              <Step tone={data.applied ? "yes" : "warn"}>
                {data.applied ? (
                  <>
                    <b>Result</b> — {data.applied.peerCount} peer
                    {data.applied.peerCount === 1 ? "" : "s"}
                    {age ? ` · ${age.text}` : ""}
                  </>
                ) : (
                  <>
                    <b>Result</b> — no peer set matched. Multiples unavailable; benchmarking below
                    still works.
                  </>
                )}
              </Step>
            </>
          )}
        </div>
      </div>

      {/* Suggestion — never without its caution */}
      {suggestion && (
        <>
          <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#D3E0FB] bg-[#EFF4FE] px-[15px] py-[13px] text-[12.5px] text-[#1E3A8A]">
            <span className="flex-1">
              A <b>{suggestion.label}</b> set exists with {suggestion.peerCount} peer
              {suggestion.peerCount === 1 ? "" : "s"}. Setting this startup's business model to{" "}
              <b>{businessModelLabel(suggestion.businessModel) ?? suggestion.businessModel}</b>{" "}
              would match it.
            </span>
            {canEdit && (
              <Button
                variant="outline"
                className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold"
                disabled={save.isPending}
                onClick={() => {
                  setModel(suggestion.businessModel);
                  save.mutate({ businessModel: suggestion.businessModel });
                }}
              >
                Set to {businessModelLabel(suggestion.businessModel) ?? suggestion.businessModel}
              </Button>
            )}
          </div>
          <div className="mt-2.5 flex items-start gap-[7px] text-[11.5px] text-[#B45309]">
            <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>
              Only if that describes the company. Tagging it to force a match would compare it
              against the wrong companies.
            </span>
          </div>
        </>
      )}

      {/* Admin route — creating a set is often the right fix */}
      {isControl && data.state !== "exact" && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {data.sector && data.state === "no-peer-set" && (
            <Button
              asChild
              className="h-8 rounded-[8px] bg-[#12294F] px-3.5 text-[12.5px] font-semibold hover:bg-[#12294F]/90"
            >
              <Link to="/peer-comparables" search={{ sector: data.sector }}>
                Create a sector-wide peer set
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold text-[#1D4ED8] hover:bg-[#EFF4FE]"
          >
            <Link to="/peer-comparables" search={{}}>
              Manage peer sets →
            </Link>
          </Button>
        </div>
      )}

      {/* Applied set */}
      {(data.state === "sector-only" || data.state === "exact") && data.applied && (
        <div className="mt-4 overflow-x-auto">
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
          {data.state === "exact" && (
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Matched on <b>Sector + Business model</b>. Industry played no part.
            </p>
          )}
        </div>
      )}

      {filingStale && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-[10px] border border-[#F6DFB4] bg-[#FEF3E7] px-3.5 py-2.5 text-[12.5px] text-[#7C4A0B]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <b>Filing is from FY{year}</b> — figures may not reflect current trading.
          </span>
        </div>
      )}

      {/* Summary / Methods */}
      <div className="mt-4 rounded-[9px] border border-[#EAECEF] bg-white">
        <div className="flex gap-5 border-b border-[#EAECEF] px-[18px]">
          {([
            ["summary", "Summary"],
            ["methods", "Methods"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSubTab(value)}
              className={`flex items-center gap-[7px] border-b-[1.5px] py-2.5 text-[12.5px] ${
                subTab === value
                  ? "border-[#1E3A8A] font-semibold text-[#1E3A8A]"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {value === "methods" && (
                <span
                  className={`h-[5px] w-[5px] rounded-full ${
                    flag ? "bg-[#B45309]" : "bg-[#C7CDD6]"
                  }`}
                />
              )}
              {label}
            </button>
          ))}
        </div>
        <div className="px-[18px] pb-[18px] pt-4">
          {subTab === "summary" ? (
            hasPeers ? (
              <ValuationSummary
                startupName={startupName}
                year={year}
                result={result}
                discounts={discounts}
                setDiscounts={setDiscounts}
                peers={peers}
                peerLabel={peerSetLabel(data.applied!.sector, data.applied!.businessModel)}
                refreshText={age?.text ?? null}
                refreshStale={!!age?.stale}
                matchBasis={
                  data.state === "exact"
                    ? "matched on sector + business model"
                    : "matched on sector only"
                }
                ratios={ratios}
                income={income}
                onMethods={() => setSubTab("methods")}
              />
            ) : (
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
                      : "— peer set is empty"
                }
              />
            )
          ) : (
            <ValuationMethods result={result} inputs={inputs} />
          )}
        </div>
      </div>
    </div>
  );
}
