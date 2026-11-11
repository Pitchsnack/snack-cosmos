import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MainTabBar,
  MetaValue,
  PageTitle,
  SubTabRow,
} from "@/components/financials/fin-tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatementTable } from "@/components/financials/statement-table";
import { CompanyProfileCard } from "./company-profile-card";
import { ReportsHub } from "@/components/reports/reports-hub";
import { FinancialReportView } from "@/components/financials/financial-report-view";
import { useTranslation } from "@/i18n/language";
import { ValuationTab } from "@/components/financials/valuation-tab";
import { CompanyRiskReport } from "@/components/financials/company-risk-report";
import { FinancialsOverview } from "@/components/financials/financials-overview";
import { ReportScroll } from "@/components/reports/report-scroll";
import { FinancialsEdit } from "@/components/financials/financials-edit";
import { FinIcon } from "@/components/financials/fin-icon";
import { CASH_FLOW_SECTIONS, INCOME_ROWS, POSITION_ROWS, fmtCapital } from "@/lib/financials";
import { getStartupFinancials } from "@/lib/financials.functions";
import { getCompanyInfoTh } from "@/lib/company-info.functions";
import { VerificationPointer } from '@/components/company-verification/page';
import type { StartupFinancials } from "@/lib/financials.functions";
import {
  autoEnrichFinancials,
  clearStartupFinancials,
  saveStartupFinancials,
} from "@/lib/financials-edit.functions";
import { usePermissions } from "@/hooks/use-session-context";
import { FINANCIALS_STALE_TIME, financialsQueryKey } from "@/hooks/use-has-financials";
import { HatSkeleton } from "@/components/ui/PitchSnackLoader";
import { StartupEditPopup } from "@/components/startups/startup-edit-popup";


const NAVY = "#122B54";
const BLUE = "#2563EB";
const DASH = "–";

const REMARKS = [
  "This statement includes only important accounts.",
  "% Change is a year-over-year change of the current fiscal year and the previous fiscal year amount.",
  "The accounts showing in the statement depend on the accounting format submitted.",
];

export function StartupFinancialsPage({
  id,
  workspace = "startups",
  initialTab,
  readOnly = false,
  section,
  initialProfileEdit = false,
  embedded = false,
}: {
  /** Inside the seller's tabbed reports page: no Back, page edges. */
  embedded?: boolean;
  id: string;
  workspace?: "startups" | "my-startups";
  initialTab?: string;
  /** Seller view: live figures, no Edit / Refresh controls. */
  readOnly?: boolean;
  /** Seller pages: "financials" hides Valuation; "valuation" shows only Valuation. */
  section?: "financials" | "valuation";
  initialProfileEdit?: boolean;
}) {
  const { language } = useTranslation();
  const fetchFinancials = useServerFn(getStartupFinancials);
  const clearFinancials = useServerFn(clearStartupFinancials);
  const enrichFinancials = useServerFn(autoEnrichFinancials);
  const saveFinancials = useServerFn(saveStartupFinancials);
  const queryClient = useQueryClient();
  const [profileEdit, setProfileEdit] = useState(initialProfileEdit);
  const navigate = useNavigate();
  const { has, isControl } = usePermissions();
  const canManage = !readOnly && (isControl || has("startups.write"));

  // Old links to the three statements still work: they open Financial
  // Statements with that statement selected.
  const STATEMENT_TABS = ["income", "position", "cash-flow"] as const;
  const legacy = STATEMENT_TABS.find((v) => v === initialTab || `${v}-statement` === initialTab);
  const tab = section === "valuation" || initialTab === "valuation" ? "valuation" : "statements";
  const [statementTab, setStatementTab] = useState<string>(() => {
    if (legacy) return legacy;
    if (typeof window !== "undefined") {
      const last = window.sessionStorage.getItem("financials.statementTab");
      if (last && (STATEMENT_TABS as readonly string[]).includes(last)) return last;
    }
    return "income";
  });
  useEffect(() => {
    if (typeof window !== "undefined")
      window.sessionStorage.setItem("financials.statementTab", statementTab);
  }, [statementTab]);
  const [editing, setEditing] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async (skipConfirm = false): Promise<number[] | null> => {
    if (refreshing) return null;
    const ok = skipConfirm || window.confirm(
      "Clear all stored financial data for this startup and re-extract it from the DBD Data Warehouse?",
    );
    if (!ok) return null;
    setRefreshing(true);
    const toastId = toast.loading("Clearing data and re-extracting…");
    try {
      const result = await enrichFinancials({ data: { startupId: id } });
      if (result.status !== "ok" || !result.years?.length) {
        toast.error(result.message ?? "Auto extraction returned no data. Existing data kept.", {
          id: toastId,
        });
        return null;
      }
      await clearFinancials({ data: { startupId: id } });
      await saveFinancials({
        data: {
          startupId: id,
          years: result.years,
          ...(result.profile ? { profile: result.profile } : {}),
          provenance: {
            source: "DBD_DATA_WAREHOUSE",
            sourceReference: result.sourceReference ?? null,
            matchedRegisteredNumber: result.matchedRegisteredNumber ?? null,
            matchedRegisteredName: result.matchedRegisteredName ?? null,
            retrievedAt: result.retrievedAt ?? null,
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["startup-financials", id] });
      await queryClient.invalidateQueries({ queryKey: ["company-info-th", id] });
      setYear(undefined);
      toast.success(`Refreshed ${result.years.length} fiscal year(s) from DBD.`, { id: toastId });
      return (result.years as any[]).map((y) => Number(y?.fiscalYear ?? y?.fiscal_year ?? y?.year)).filter(Boolean);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed.", { id: toastId });
      return null;
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCompanyInfo = useServerFn(getCompanyInfoTh);
  const { data: companyInfo } = useQuery({
    queryKey: ["company-info-th", id],
    queryFn: () => fetchCompanyInfo({ data: { startupId: id } }),
    staleTime: FINANCIALS_STALE_TIME,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: financialsQueryKey(id),
    queryFn: () => fetchFinancials({ data: { startupId: id } }),
    staleTime: FINANCIALS_STALE_TIME,
    gcTime: 10 * 60_000,
  });




  if (initialTab === "ratios" || initialTab === "financial-ratios" || initialTab === "pnl") {
    return <ReportsHub mode={workspace === "my-startups" ? "seller" : "admin"} companyId={id} initialReport={initialTab === "pnl" ? "pnl" : "statements"} initialReportTab={initialTab}/>;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] bg-[#F4F6FA] p-6">
        <HatSkeleton lines={6} headMessage="Loading financial statements…" delay={0} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Failed to load financials: {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const years = data.years;
  const sortedYears = [...years].sort((a, b) => a - b);
  const activeYear =
    year !== undefined && sortedYears.includes(year) ? year : sortedYears[sortedYears.length - 1];
  const range = sortedYears.length
    ? `${sortedYears[0]}–${sortedYears[sortedYears.length - 1]}`
    : "—";
  const backTo = workspace === "my-startups" ? "/my-startups" : "/startups";
  const isSample = data.statements.some((s) => s.source_name === "Sample dataset");
  // The Cash Flow dot follows the data, not the tab name.
  const hasCashFlow = data.cashFlow.some(
    (i) => typeof i.amount === "number" && Number.isFinite(i.amount),
  );

  return (
    <div className={embedded ? "space-y-4 pt-2" : "space-y-4 bg-[#F4F6FA] p-6"}>
      <div className={embedded ? "flex flex-wrap items-center gap-3" : "flex flex-wrap items-start gap-3"}>
        <div className="min-w-0">
          {!embedded && <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link to={backTo} search={{ panel: id } as never}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
            </Link>
          </Button>}
          <h1 className="text-[25px] font-bold tracking-[-0.015em]" style={{ color: NAVY }}>
            {section === "valuation" ? "Indicative Valuation" : language === "th" ? "งบการเงิน" : "Financial Statements"}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Juristic Name :{" "}
            {data.legalNameEn || data.legalNameTh || data.registeredName || data.startupName}
            {sortedYears.length ? ` · Summary for ${range}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">Unit : Baht ({data.currency})</Badge>
          {sortedYears.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0F1B33]"
                >
                  <FinIcon name="calendar" className="h-[15px] w-[15px] text-muted-foreground" />
                  {activeYear}
                  <FinIcon name="chevron-down" className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[...sortedYears].reverse().map((y) => (
                  <DropdownMenuItem key={y} onSelect={() => setYear(y)}>
                    {y}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0F1B33]"
          >
            <FinIcon name="download" className="h-[15px] w-[15px] text-muted-foreground" />
            Export PDF
          </button>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              title="Clear stored data and re-run Auto extraction from DBD"
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh data"}
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editing ? "Close editor" : "Edit"}
            </Button>
          )}

        </div>
      </div>

      <ReportScroll>
      {isSample && !editing && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Demo data — not from the DBD Data Warehouse.</span> These
          figures are placeholders. Open the editor and run Auto Enrich to replace them with the
          company&rsquo;s filed statements.
        </div>
      )}

      {!editing && (
        <CompanyProfileCard
          data={data}
          years={sortedYears}
          activeYear={activeYear}
          onSelectYear={setYear}
        />
      )}
      {!editing && tab === "valuation" && workspace === "my-startups" && <div className="flex justify-end"><Button variant="link" onClick={() => setProfileEdit(true)}><Pencil className="mr-2 h-4 w-4" />Edit information</Button></div>}
      {profileEdit && <StartupEditPopup id={id} seller onClose={() => {setProfileEdit(false); if(initialProfileEdit) void navigate({search:((p:Record<string,unknown>)=>({...p,edit:undefined})) as never,replace:true}); queryClient.invalidateQueries({queryKey:["startup-financials",id]});}} />}


      {/* Seller-only: /my-verification resolves the caller's own companies, so the link would be wrong on Admin screens. */}
      {!editing && section !== 'valuation' && workspace === 'my-startups' && <VerificationPointer companyId={id} />}
      {editing ? (
        <FinancialsEdit
          startupId={id}
          data={data}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ["startup-financials", id] });
          }}
        />
      ) : years.length === 0 && !companyInfo?.exists ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
          <p className="text-sm font-medium">No financial data recorded for this startup</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Financial statements appear here once fiscal-year data is imported. Nothing is estimated or
            generated automatically.
          </p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-[#EAECEF] bg-white pt-3">
          {tab === "statements" && <FinancialReportView data={data} report="statements" year={activeYear} tab={statementTab} onTab={setStatementTab}/>}

          {tab === "valuation" && (
            <ValuationTab
              startupId={id}
              startupName={data.startupName}
              workspace={workspace}
              year={activeYear}
              ratios={data.ratios}
              income={data.income}
              position={data.position}
              cashFlow={data.cashFlow}
              readOnly={readOnly}
            />
          )}

        </div>
      )}
      </ReportScroll>
    </div>
  );
}

function Remarks() {
  return (
    <div className="flex gap-3 text-xs text-muted-foreground">
      <span className="font-medium">Remark(s) :</span>
      <ol className="list-decimal space-y-1 pl-4">
        {REMARKS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </div>
  );
}
