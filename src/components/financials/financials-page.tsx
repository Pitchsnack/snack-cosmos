import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatementTable } from "@/components/financials/statement-table";
import { RatiosTable } from "@/components/financials/ratios-table";
import { FinancialsOverview } from "@/components/financials/financials-overview";
import { FinancialsEdit } from "@/components/financials/financials-edit";
import { FinIcon } from "@/components/financials/fin-icon";
import { CASH_FLOW_SECTIONS, INCOME_ROWS, POSITION_ROWS } from "@/lib/financials";
import { getStartupFinancials } from "@/lib/financials.functions";
import type { StartupFinancials } from "@/lib/financials.functions";
import { usePermissions } from "@/hooks/use-session-context";

const NAVY = "#122B54";
const BLUE = "#2563EB";
const DASH = "–";

const REMARKS = [
  "This statement includes only important accounts.",
  "% Change is a year-over-year change of the current fiscal year and the previous fiscal year amount.",
  "The accounts showing in the statement depend on the accounting format submitted.",
];

function CompanyProfileCard({
  data,
  years,
  activeYear,
  onSelectYear,
}: {
  data: StartupFinancials;
  years: number[];
  activeYear: number | undefined;
  onSelectYear: (year: number) => void;
}) {
  const p = data.profile;
  const operating = (p.status ?? "").toLowerCase() === "active" || (p.status ?? "").toLowerCase() === "operating";
  const rows: [string, string, boolean?][][] = [
    [
      ["Registered Type", p.registeredType ?? DASH],
      ["Status", p.status ?? DASH, true],
      ["Registered Date", p.registeredDate ?? DASH],
    ],
    [
      ["Registered Capital", p.registeredCapital ?? DASH],
      ["Last Registered ID", p.registeredNumber ?? DASH],
      ["Business Size", p.businessSize ?? DASH],
    ],
  ];

  return (
    <div className="rounded-[13px] border border-[#E5E7EB] bg-white px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[#EAF1FD]" style={{ color: NAVY }}>
          <FinIcon name="building" className="h-[21px] w-[21px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 border-b border-[#EFF1F4] pb-2 text-[15.5px] font-bold" style={{ color: NAVY }}>
            Company Profile
          </div>
          <div className="grid gap-y-2 gap-x-7 md:[grid-template-columns:1fr_1fr_1.15fr]">
            {rows.map((col, i) => (
              <div key={i} className="grid [align-content:start] gap-x-[18px] gap-y-1.5 [grid-template-columns:auto_1fr]">
                {col.map(([k, v, isStatus]) => (
                  <div key={k} className="contents">
                    <div className="whitespace-nowrap py-0.5 text-[12.5px] font-semibold text-[#0F1B33]">{k}</div>
                    <div
                      className="py-0.5 text-[12.5px] text-[#374151]"
                      style={isStatus && v !== DASH ? { color: operating ? "#16A34A" : "#EA8A0B", fontWeight: 600 } : undefined}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div>
              <div className="mb-1.5 text-[12.5px] font-semibold text-[#0F1B33]">
                Fiscal Year (submitted financial statement)
              </div>
              <div className="mb-1 flex flex-wrap gap-x-3.5 gap-y-1">
                {years.length === 0 ? (
                  <span className="text-[12.5px] text-muted-foreground">{DASH}</span>
                ) : (
                  [...years]
                    .sort((a, b) => b - a)
                    .map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => onSelectYear(y)}
                        className={`text-[12.5px] ${y === activeYear ? "font-bold underline" : "font-medium"}`}
                        style={{ color: BLUE }}
                      >
                        {y}
                      </button>
                    ))
                )}
              </div>
              <div className="text-[11.5px] text-muted-foreground">(click to display financial statements)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartupFinancialsPage({
  id,
  workspace = "startups",
}: {
  id: string;
  workspace?: "startups" | "my-startups";
}) {
  const fetchFinancials = useServerFn(getStartupFinancials);
  const queryClient = useQueryClient();
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);


  const { data, isLoading, error } = useQuery({
    queryKey: ["startup-financials", id],
    queryFn: () => fetchFinancials({ data: { startupId: id } }),
  });



  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading financials…
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

  return (
    <div className="space-y-4 bg-[#F4F6FA] p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link to={backTo} search={{ panel: id } as never}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
            </Link>
          </Button>
          <h1 className="text-[25px] font-bold tracking-[-0.015em]" style={{ color: NAVY }}>
            Financial Overview
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Juristic Name : {data.registeredName || data.startupName}
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
            <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editing ? "Close editor" : "Edit"}
            </Button>
          )}
        </div>
      </div>

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
      ) : years.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
          <p className="text-sm font-medium">No financial data recorded for this startup</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Financial statements appear here once fiscal-year data is imported. Nothing is estimated or
            generated automatically.
          </p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-6 rounded-none border-b border-[#E5E7EB] bg-transparent p-0">
            {[
              ["overview", "Overview"],
              ["income", "Income Statement"],
              ["position", "Financial Position"],
              ["cash-flow", "Cash Flow Statement"],
              ["ratios", "Financial Ratios"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2.5 text-[13.5px] text-muted-foreground shadow-none data-[state=active]:border-[#2563EB] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#2563EB] data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <FinancialsOverview
              year={activeYear}
              years={years}

              currency={data.currency}
              income={data.income}
              position={data.position}
              ratios={data.ratios}
            />
          </TabsContent>

          <TabsContent value="income" className="mt-4 space-y-3">
            <h2 className="text-lg font-semibold">Income Statement for the year {range}</h2>
            <StatementTable years={years} rows={INCOME_ROWS} items={data.income} />
            <Remarks />
          </TabsContent>

          <TabsContent value="position" className="mt-4 space-y-3">
            <h2 className="text-lg font-semibold">
              Statement of Financial Position for the year {range}
            </h2>
            <StatementTable years={years} rows={POSITION_ROWS} items={data.position} />
            <Remarks />
          </TabsContent>

          <TabsContent value="cash-flow" className="mt-4 space-y-3">
            <h2 className="text-lg font-semibold">Cash Flow Statement for the year {range}</h2>
            <StatementTable
              years={years}
              items={data.cashFlow}
              sections={CASH_FLOW_SECTIONS.map((s) => ({ title: s.title, rows: s.rows }))}
            />
            <Remarks />
          </TabsContent>

          <TabsContent value="ratios" className="mt-4 space-y-3">
            <h2 className="text-lg font-semibold">Major Financial Ratios for the year {range}</h2>
            <RatiosTable years={years} ratios={data.ratios} />
          </TabsContent>
        </Tabs>
      )}
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
