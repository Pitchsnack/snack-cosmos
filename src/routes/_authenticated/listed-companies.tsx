import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Layers, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionGuard } from "@/components/permission-guard";
import { ListedCompanyDialog } from "@/components/peer-comparables/listed-company-dialog";
import { cn } from "@/lib/utils";
import { EMPTY_CELL, fmtMetric } from "@/lib/peer-comparables";
import {
  downloadCsv,
  listedCompaniesToCsv,
  listedCsvFilename,
  MARKET_TABS,
  parseListedCsv,
  type ListedCompany,
  type ListedCompanyInput,
  type MarketTab,
} from "@/lib/listed-companies";
import {
  deleteListedCompany,
  importListedCompanies,
  listListedCompanies,
} from "@/lib/listed-companies.functions";

export const Route = createFileRoute("/_authenticated/listed-companies")({
  head: () => ({
    meta: [
      { title: "Listed Companies — SnackPortal2" },
      {
        name: "description",
        content:
          "The master table of SET and mai listed companies, with the ratios every peer set draws on.",
      },
      { property: "og:title", content: "Listed Companies — SnackPortal2" },
      {
        property: "og:description",
        content:
          "One row per ticker: market, sector, revenue and valuation ratios shared by all peer sets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListedCompaniesRoute,
});

function ListedCompaniesRoute() {
  return (
    <PermissionGuard
      permission="roles.read"
      allowControl
      message="Listed Companies is available to administrators only."
    >
      <ListedCompaniesPage />
    </PermissionGuard>
  );
}

function ListedCompaniesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listListedCompanies);
  const importFn = useServerFn(importListedCompanies);
  const deleteFn = useServerFn(deleteListedCompany);
  const fileRef = useRef<HTMLInputElement>(null);

  // On-screen only: a reload starts on "All markets" again.
  const [tab, setTab] = useState<MarketTab>("all");
  const [editing, setEditing] = useState<ListedCompanyInput | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ListedCompany | null>(null);

  const { data, isLoading } = useQuery<ListedCompany[]>({
    queryKey: ["listed-companies"],
    queryFn: () => listFn(),
  });

  const all = data ?? [];
  const counts = useMemo(
    () => ({
      all: all.length,
      SET: all.filter((c) => c.market === "SET").length,
      mai: all.filter((c) => c.market === "mai").length,
    }),
    [all],
  );
  const rows = tab === "all" ? all : all.filter((c) => c.market === tab);

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const { rows: parsed, errors } = parseListedCsv(await file.text());
      if (errors.length) toast.warning(errors.slice(0, 3).join(" "));
      if (parsed.length === 0) throw new Error("Nothing to import from that file.");
      return importFn({ data: { rows: parsed } });
    },
    onSuccess: (r) => {
      toast.success(`${r.created} added, ${r.updated} updated.`);
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Company removed.");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
      qc.invalidateQueries({ queryKey: ["peer-sets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/peer-comparables" search={{}}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Peer Comparables
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Administration
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Listed Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One row per ticker. Peer sets reference these rows, so a figure updated here updates
          every set that uses the company.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-1 rounded-[10px] bg-muted/60 p-1">
            {MARKET_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-pressed={tab === t.value}
                className={cn(
                  "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                  tab === t.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {counts[t.value]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv.mutate(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(listedCsvFilename(tab), listedCompaniesToCsv(rows))}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add company
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="bg-[hsl(222_47%_23%)] text-white">
                <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Ticker
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Company
                </th>
                <th className="w-20 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Market
                </th>
                <th className="w-44 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  Sector
                </th>
                {["Revenue THB m", "EBITDA margin", "EV/EBITDA", "P/E", "P/BV"].map((h) => (
                  <th
                    key={h}
                    className="w-28 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
                <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                  As at
                </th>
                <th className="w-20 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                  Used in
                </th>
                <th className="w-12 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    No companies on this market yet. Add one, or import a CSV.
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-muted/40"
                    onClick={() => {
                      setEditing({
                        id: c.id,
                        ticker: c.ticker,
                        name: c.name,
                        market: c.market,
                        sector: c.sector,
                        revenueThbM: c.revenueThbM,
                        ebitdaMarginPct: c.ebitdaMarginPct,
                        evEbitda: c.evEbitda,
                        pe: c.pe,
                        pbv: c.pbv,
                        asAt: c.asAt,
                      });
                      setDialogOpen(true);
                    }}
                  >
                    <td className="px-3 py-2.5 font-semibold">{c.ticker}</td>
                    <td className="px-3 py-2.5">{c.name}</td>
                    <td className="px-3 py-2.5 text-center">{c.market}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.sector ?? EMPTY_CELL}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {fmtMetric(c.revenueThbM)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {fmtMetric(c.ebitdaMarginPct, "%")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {fmtMetric(c.evEbitda, "×")}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtMetric(c.pe, "×")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {fmtMetric(c.pbv, "×")}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.asAt ?? EMPTY_CELL}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{c.usedIn}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(c);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          A company used in no peer set is perfectly normal — the table is a reference list, not a
          to-do list.
        </p>
      </div>

      <ListedCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultMarket={tab === "mai" ? "mai" : "SET"}
        initial={editing}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.ticker} — {pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.usedIn > 0 ? (
                <>
                  This company is used in {pendingDelete.usedIn} peer set
                  {pendingDelete.usedIn === 1 ? "" : "s"}:{" "}
                  <b>{pendingDelete.usedInSets.join(", ")}</b>. Deleting it removes it from{" "}
                  {pendingDelete.usedIn === 1 ? "that set" : "those sets"} and changes every
                  valuation that relies on them.
                </>
              ) : (
                <>This company is not used in any peer set.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
