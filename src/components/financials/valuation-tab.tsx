/**
 * Valuation tab — matching, peer comparison and benchmarking.
 *
 * Peer matching uses Sector and Business model ONLY. Industry is never
 * consulted, not even as a fallback.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/hooks/use-session-context";
import { getPeerMatch, getPeerSet } from "@/lib/peer-comparables.functions";
import { peerSetLabel } from "@/lib/peer-comparables";
import { businessModelLabel } from "@/lib/sectors";
import { updateStartup } from "@/lib/startups.functions";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";
import { MatchingRow } from "@/components/financials/matching-row";
import { MetaValue, PageTitle, SubTabRow } from "@/components/financials/fin-tabs";
import { Loading } from "@/components/ui/PitchSnackLoader";
import { ValuationSummary } from "@/components/financials/valuation-summary";
import { ValuationMethods } from "@/components/financials/valuation-methods";
import { AdjustmentsTab } from "@/components/financials/adjustments-tab";
import {
  getValuationAdjustments,
  saveValuationSettings,
} from "@/lib/valuation-adjustments.functions";
import {
  DEFAULT_VALUATION_SETTINGS,
  normalise,
  type FilingLine,
} from "@/lib/valuation-adjustments";
import {
  DEFAULT_DISCOUNTS,
  computeValuation,
  peerMedians,
  readFilingInputs,
  type Discounts,
} from "@/lib/valuation";
import {
  getStartupPeers,
  listPeerCandidates,
  saveStartupPeers,
  setStartupPeerBasis,
} from "@/lib/startup-peers.functions";
import { PeerBasisRow, PeerPickerDialog } from "@/components/financials/peer-basis";


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

  // Peers from — the sector set, or companies chosen for this startup alone.
  const fetchSelection = useServerFn(getStartupPeers);
  const fetchCandidates = useServerFn(listPeerCandidates);
  const persistSelection = useServerFn(saveStartupPeers);
  const persistBasis = useServerFn(setStartupPeerBasis);
  const selectionKey = ["startup-peers", startupId] as const;
  const { data: selection } = useQuery({
    queryKey: selectionKey,
    queryFn: () => fetchSelection({ data: { startupId } }),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: candidates } = useQuery({
    queryKey: ["peer-candidates"],
    enabled: pickerOpen,
    staleTime: 300_000,
    queryFn: () => fetchCandidates(),
  });
  const savePeers = useMutation({
    mutationFn: (ids: string[]) =>
      persistSelection({ data: { startupId, listedCompanyIds: ids } }),
    onSuccess: async () => {
      setPickerOpen(false);
      await queryClient.invalidateQueries({ queryKey: selectionKey });
      toast.success("Peer companies saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the companies"),
  });
  const changeBasis = useMutation({
    mutationFn: (basis: "sector" | "chosen") => persistBasis({ data: { startupId, basis } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: selectionKey }),
    onError: (e: Error) => toast.error(e.message || "Could not switch the peer basis"),
  });

  const [subTab, setSubTab] = useState<"summary" | "methods" | "adjustments">("summary");
  const [discounts, setDiscounts] = useState<Discounts>(DEFAULT_DISCOUNTS);
  const [sector, setSector] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  // Earnings adjustments live per startup and fiscal year.
  const fetchAdjustments = useServerFn(getValuationAdjustments);
  const adjKey = ["valuation-adjustments", startupId, year ?? 0] as const;
  const { data: adjData } = useQuery({
    queryKey: adjKey,
    enabled: !!year,
    queryFn: () => fetchAdjustments({ data: { startupId, fiscalYear: year! } }),
  });
  const adjustments = adjData?.adjustments ?? [];
  const settings = adjData?.settings ?? DEFAULT_VALUATION_SETTINGS;

  // The one peer chosen for the Benchmark, kept per startup and fiscal year.
  const persistSettings = useServerFn(saveValuationSettings);
  const choosePeer = useMutation({
    mutationFn: (benchmarkPeerId: string | null) =>
      persistSettings({ data: { startupId, fiscalYear: year!, benchmarkPeerId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adjKey }),
    onError: (e: Error) => toast.error(e.message || "Could not save the peer"),
  });


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
      <div className="rounded-xl border border-dashed border-border bg-white p-10">
        <Loading message="Loading valuation…" delay={0} />
      </div>
    );
  }

  const modelLabel = data.businessModel
    ? (businessModelLabel(data.businessModel) ?? data.businessModel)
    : null;
  const suggestion = data.narrower && data.state !== "exact" ? data.narrower : null;

  const sectorPeers = peerSet?.peers ?? [];
  const chosenPeers = selection?.peers ?? [];
  const basis: "sector" | "chosen" =
    selection?.basis === "chosen" && chosenPeers.length > 0 ? "chosen" : "sector";
  const peers = basis === "chosen" ? chosenPeers : sectorPeers;
  const inputs = readFilingInputs(year, income, position, cashFlow, ratios);
  const norm = normalise(adjustments, settings, inputs.netProfit, inputs.revenue);
  // Reported figures, then the same maths on normalised profit.
  const baseResult = computeValuation(inputs, peers, discounts);
  const result = norm.applied
    ? computeValuation(inputs, peers, discounts, {
        netProfit: norm.normalisedNetProfit,
        revenue: norm.normalisedRevenue,
        applied: true,
      })
    : baseResult;
  const hasPeers = peers.length > 0 && (basis === "chosen" || !!data.applied);
  const usableCount = result.methods.filter(
    (m) => m.status === "usable" || m.status === "low confidence",
  ).length;

  const lineAmount = (code: string) =>
    income.find((i) => i.item_code === code && i.fiscal_year === year)?.amount ?? null;
  const totalExpenses = lineAmount("total_expenses");
  const cogs = lineAmount("cost_of_goods_sold");
  const sellingAdmin = lineAmount("selling_admin_expenses");
  const filingLines: Record<FilingLine, number | null> = {
    cost_of_goods_sold: cogs,
    selling_admin: sellingAdmin,
    other_expenses:
      totalExpenses === null
        ? null
        : Math.max(0, totalExpenses - (cogs ?? 0) - (sellingAdmin ?? 0)),
    // Revenue lines have no cap — the 10% revenue check takes that place.
    revenue: inputs.revenue,
    other_income: null,
  };

  const appliedLabel = data.applied
    ? peerSetLabel(data.applied.sector, data.applied.businessModel)
    : null;

  // Context line on the right of the sub-tab row — it follows the sub-tab.
  const adjShare =
    norm.applied && norm.normalisedNetProfit
      ? Math.abs(norm.netEffect / norm.normalisedNetProfit) * 100
      : null;
  const contextLine =
    subTab === "summary" ? (
      <>
        <span>
          Filing <MetaValue>FY{year ?? "—"}</MetaValue>
        </span>
        <span>
          Peer set <MetaValue>{appliedLabel ?? "none matched"}</MetaValue>
        </span>
        {age?.text && <span>{age.text}</span>}
      </>
    ) : subTab === "methods" ? (
      <>
        <span>
          Filing <MetaValue>FY{year ?? "—"}</MetaValue>
        </span>
        <span className="flex items-center gap-1.5">
          {result.blocked && <span className="h-[6px] w-[6px] rounded-full bg-[#B45309]" />}
          <MetaValue>
            {usableCount} of {result.methods.length}
          </MetaValue>{" "}
          methods usable
        </span>
      </>
    ) : norm.savedCount === 0 ? (
      <span>None — reported figures used as filed</span>
    ) : (
      <>
        <span>
          <MetaValue>{norm.appliedCount}</MetaValue> applied
        </span>
        <span>
          <MetaValue>{norm.savedCount}</MetaValue> saved
        </span>
        <span>
          Tax rate <MetaValue>{settings.taxRate}%</MetaValue>
        </span>
        {adjShare !== null && (
          <span className="text-[#B45309]">
            {adjShare.toFixed(0)}% of normalised profit from adjustments
          </span>
        )}
      </>
    );


  const startupRevenueM = inputs.revenue !== null ? inputs.revenue / 1e6 : null;
  const sectorMedianRevM = peerMedians(sectorPeers).revenueThbM;
  const sizeNote =
    basis === "sector" &&
    startupRevenueM !== null &&
    startupRevenueM > 0 &&
    sectorMedianRevM !== null &&
    (sectorMedianRevM > 2 * startupRevenueM || sectorMedianRevM < 0.5 * startupRevenueM)
      ? `The set's median revenue is ${Math.round(sectorMedianRevM).toLocaleString("en-US")}m against this company's ${Math.round(startupRevenueM).toLocaleString("en-US")}m — companies of a very different size.`
      : null;

  const chosenOn = selection?.chosenAt
    ? new Date(selection.chosenAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const chosenLabel =
    basis === "chosen"
      ? `Chosen companies · ${peers.length} peers${selection?.chosenByName ? ` · chosen by ${selection.chosenByName}` : ""}${chosenOn ? ` on ${chosenOn}` : ""}`
      : null;

  const basisRow = (
    <>
      <PeerBasisRow
        basis={selection?.basis ?? "sector"}
        canEdit={canEdit}
        onBasis={(b) => changeBasis.mutate(b)}
        onChoose={() => setPickerOpen(true)}
      />
      {sizeNote && (
        <div className="mb-[9px] rounded-[7px] border border-[#F6DFB4] bg-[#FEF3E7] px-3 py-2 text-[11.5px] text-[#7C4A0B]">
          {sizeNote}
        </div>
      )}
      <PeerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={candidates ?? []}
        initialSelected={chosenPeers.map((p) => p.id!).filter(Boolean)}
        startupRevenueThbM={startupRevenueM}
        saving={savePeers.isPending}
        onSave={(ids) => savePeers.mutate(ids)}
      />
    </>
  );

  const chosenStrip = (right?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2 rounded-[7px] border border-[#F6DFC4] bg-[#FFF7ED] px-3 py-2 text-[11.5px] text-[#7C4A0B]">
      <span>
        <b>{chosenLabel}</b>
        {sectorMedianRevM !== null && basis === "chosen"
          ? ` · median revenue ${Math.round(peerMedians(peers).revenueThbM ?? 0).toLocaleString("en-US")}m`
          : ""}
      </span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );

  const matching = (right?: React.ReactNode) =>
    basis === "chosen" ? (
      chosenStrip(right)
    ) : (
    <MatchingRow
      sector={sector}
      model={model}
      canEdit={canEdit}
      isControl={isControl}
      onSector={(v) => {
        setSector(v);
        save.mutate({ sector: v });
      }}
      onModel={(v) => {
        setModel(v);
        save.mutate({ businessModel: v });
      }}
      appliedLabel={appliedLabel}
      peerCount={data.applied?.peerCount ?? null}
      refreshText={age?.text ?? null}
      suggestion={
        suggestion
          ? {
              label: suggestion.label,
              peerCount: suggestion.peerCount,
              model: suggestion.businessModel,
              modelLabel:
                businessModelLabel(suggestion.businessModel) ?? suggestion.businessModel,
            }
          : null
      }
      right={right}
    />
  );

  return (
    <div>
      {filingStale && (
        <div className="mb-3.5 flex items-center gap-2.5 rounded-[10px] border border-[#F6DFB4] bg-[#FEF3E7] px-3.5 py-2.5 text-[12.5px] text-[#7C4A0B]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <b>Filing is from FY{year}</b> — figures may not reflect current trading.
          </span>
        </div>
      )}


      {/* Summary / Methods / Adjustments */}
      <div>
        <SubTabRow
          value={subTab}
          onChange={(v) => setSubTab(v as typeof subTab)}
          tabs={[
            { value: "summary", label: "Summary", icon: "target" },
            {
              value: "methods",
              label: "Methods",
              icon: "lines",
              ...(result.blocked
                ? {
                    dot: "amber" as const,
                    dotTitle: `${result.blocked.name} is blocked — ${result.blocked.reason}`,
                  }
                : {}),
            },
            {
              value: "adjustments",
              label: "Adjustments",
              icon: "sliders",
              count: norm.appliedCount,
            },
          ]}
          meta={contextLine}
        />
        <div className="px-[18px] pb-[18px]">
          <PageTitle
            title={
              subTab === "summary"
                ? "Summary"
                : subTab === "methods"
                  ? "Methods"
                  : "Adjustments"
            }
            sub={
              subTab === "summary"
                ? "the indicative range, and how it compares"
                : subTab === "methods"
                  ? "the working from the filing — inputs, each method, and what's missing"
                  : "how profit and revenue would differ under a new owner"
            }
          />
          {subTab === "adjustments" ? (
            <AdjustmentsTab
              startupId={startupId}
              year={year}
              canEdit={canEdit}
              adjustments={adjustments}
              settings={settings}
              filingLines={filingLines}
              profitBeforeTax={
                income.find(
                  (i) =>
                    i.item_code === "profit_loss_before_income_tax" && i.fiscal_year === year,
                )?.amount ?? null
              }
              reportedNetProfit={inputs.netProfit}
              reportedRevenue={inputs.revenue}
              baseResult={baseResult}
              adjustedResult={result}
              queryKey={adjKey}
            />
          ) : subTab === "summary" ? (
            hasPeers ? (
              <ValuationSummary
                startupName={startupName}
                year={year}
                result={result}
                discounts={discounts}
                setDiscounts={setDiscounts}
                peers={peers}
                refreshText={age?.text ?? null}
                ratios={ratios}
                income={income}
                inputs={inputs}
                onMethods={() => setSubTab("methods")}
                renderMatching={matching}
                normalisation={norm}
                stake={settings.stake}
                adjustments={adjustments}
                matchLabel={appliedLabel}
                selectedPeerId={settings.benchmarkPeerId ?? null}
                canChoosePeer={canEdit && year !== null && year !== undefined}
                onSelectPeer={(id) => choosePeer.mutate(id)}
              />
            ) : (
              <>
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
                <div className="mt-4 overflow-hidden rounded-[8px] border border-[#EAECEF]">
                  <div className="flex items-baseline gap-[9px] bg-[#1E3A8A] px-3 py-2">
                    <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-white">
                      Compared against
                    </h3>
                    <span className="text-[11px] text-[#B9C6E4]">
                      {appliedLabel ? "the peer set behind every figure" : "no peer set matched"}
                    </span>
                  </div>
                  <div className="p-3">{matching()}</div>
                </div>
              </>
            )
          ) : (
            <ValuationMethods result={result} inputs={inputs} normalisation={norm} />
          )}
        </div>
      </div>

    </div>
  );
}
