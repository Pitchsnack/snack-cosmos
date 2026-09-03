import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatementTable } from "@/components/financials/statement-table";
import { RatiosTable } from "@/components/financials/ratios-table";
import { FinancialsOverview } from "@/components/financials/financials-overview";
import { FinancialsEdit } from "@/components/financials/financials-edit";
import { CASH_FLOW_SECTIONS, INCOME_ROWS, POSITION_ROWS } from "@/lib/financials";
import { getStartupFinancials } from "@/lib/financials.functions";
import { usePermissions } from "@/hooks/use-session-context";


const REMARKS = [
  "This statement includes only important accounts.",
  "% Change is a year-over-year change of the current fiscal year and the previous fiscal year amount.",
  "The accounts showing in the statement depend on the accounting format submitted.",
];

export function StartupFinancialsPage({
  id,
  workspace = "startups",
}: {
  id: string;
  workspace?: "startups" | "my-startups";
}) {
  const fetchFinancials = useServerFn(getStartupFinancials);
  const loadSample = useServerFn(loadSampleFinancials);
  const queryClient = useQueryClient();
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["startup-financials", id],
    queryFn: () => fetchFinancials({ data: { startupId: id } }),
  });

  const sample = useMutation({
    mutationFn: () => loadSample({ data: { startupId: id } }),
    onSuccess: () => {
      toast.success("Sample financial dataset loaded");
      queryClient.invalidateQueries({ queryKey: ["startup-financials", id] });
    },
    onError: (e: Error) => toast.error(e.message),
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
  const range = years.length ? `${years[0]} - ${years[years.length - 1]}` : "—";
  const backTo = workspace === "my-startups" ? "/my-startups" : "/startups";
  const isSample = data.statements.some((s) => s.source_name === "Sample dataset");

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground">
            <Link to={backTo} search={{ panel: id } as never}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
            Financial Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Juristic Name : {data.registeredName || data.startupName}
            {years.length ? ` · Summary for ${range}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Unit : Baht ({data.currency})</Badge>
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
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-sm font-medium">No financial data recorded for this startup</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Financial statements appear here once fiscal-year data is imported. Nothing is estimated or
            generated automatically.
          </p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="income">Income Statement</TabsTrigger>
            <TabsTrigger value="position">Financial Position</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow Statement</TabsTrigger>
            <TabsTrigger value="ratios">Financial Ratios</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <FinancialsOverview
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
