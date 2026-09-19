import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plus, Trash2, Upload } from "lucide-react";
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
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ListedCompanyDialog } from "@/components/peer-comparables/listed-company-dialog";
import {
  ALL_SECTORS,
  Highlight,
  matchesTerm,
  ResultCount,
  TabToolbar,
} from "@/components/peer-comparables/tab-toolbar";
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
} from "@/lib/listed-companies.functions";

const MARKET_PILL: Record<MarketTab, string> = {
  all: "bg-muted text-foreground border-border",
  SET: "bg-info/10 text-info border-info/30",
  mai: "bg-success/10 text-success border-success/30",
};

export function ListedCompaniesTab({
  tabs,
  companies,
  isLoading,
  prefillName,
  onDialogClosed,
  onSavedReturn,
}: {
  tabs: ReactNode;
  companies: ListedCompany[];
  isLoading: boolean;
  /** Set when the user came from a peer set picker with a name typed. */
  prefillName?: string;
  onDialogClosed?: () => void;
  /** Called with the new company id when the user came from a peer set. */
  onSavedReturn?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const importFn = useServerFn(importListedCompanies);
  const deleteFn = useServerFn(deleteListedCompany);
  const fileRef = useRef<HTMLInputElement>(null);

  const [market, setMarket] = useState<MarketTab>("all");
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>(ALL_SECTORS);
  const [editing, setEditing] = useState<ListedCompanyInput | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ListedCompany | null>(null);

  // Arriving from the peer picker with a typed name opens the form straight away.
  useEffect(() => {
    if (prefillName) {
      setEditing(null);
      setDialogOpen(true);
    }
  }, [prefillName]);

  const counts = useMemo(
    () => ({
      all: companies.length,
      SET: companies.filter((c) => c.market === "SET").length,
      mai: companies.filter((c) => c.market === "mai").length,
    }),
    [companies],
  );

  const sectors = useMemo(
    () =>
      [...new Set(companies.map((c) => c.sector).filter((s): s is string => !!s))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [companies],
  );

  const inMarket = market === "all" ? companies : companies.filter((c) => c.market === market);
  const rows = inMarket.filter(
    (c) =>
      matchesTerm(search, c.ticker, c.name) &&
      (sectorFilter === ALL_SECTORS || c.sector === sectorFilter),
  );

  const clearAll = () => {
    setSearch("");
    setSectorFilter(ALL_SECTORS);
  };

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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-6 border-b border-border px-5">
        {tabs}
        <TabToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search ticker or company…"
          sector={sectorFilter}
          onSector={setSectorFilter}
          sectors={sectors}
          menu={
            <>
              <DropdownMenuItem
                className="font-semibold text-info focus:text-info"
                onSelect={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add company
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  downloadCsv(listedCsvFilename(market), listedCompaniesToCsv(rows))
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
            </>
          }
        />
      </div>

      {/* market sub-tabs — pills, deliberately lighter than the tabs above */}
      <div className="flex gap-1.5 px-5 pt-3.5">
        {MARKET_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setMarket(t.value)}
            aria-pressed={market === t.value}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-xs text-muted-foreground transition-colors",
              market === t.value
                ? cn("font-semibold", MARKET_PILL[t.value])
                : "hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10.5px] font-bold tabular-nums",
                market === t.value ? "bg-current/15 text-current" : "bg-muted text-muted-foreground",
              )}
            >
              {counts[t.value]}
            </span>
          </button>
        ))}
      </div>

      <ResultCount
        shown={rows.length}
        total={inMarket.length}
        noun="companies"
        term={search}
        sector={sectorFilter}
        onClear={clearAll}
      />

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

      <div className="mt-3 overflow-x-auto">
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
                  {search.trim() || sectorFilter !== ALL_SECTORS ? (
                    <>
                      No companies match “{search.trim() || sectorFilter}”.{" "}
                      <button
                        type="button"
                        onClick={clearAll}
                        className="font-medium text-info hover:underline"
                      >
                        clear all
                      </button>
                    </>
                  ) : (
                    <>No companies on this market yet. Add one, or import a CSV.</>
                  )}
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
                  <td className="px-3 py-2.5 font-semibold">
                    <Highlight text={c.ticker} term={search} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Highlight text={c.name} term={search} />
                  </td>
                  <td className="px-3 py-2.5 text-center">{c.market}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.sector ?? EMPTY_CELL}</td>
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
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMetric(c.pbv, "×")}</td>
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

      <ListedCompanyDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) onDialogClosed?.();
        }}
        defaultMarket={market === "mai" ? "mai" : "SET"}
        initial={editing}
        prefillName={prefillName}
        onSaved={(id) => onSavedReturn?.(id)}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
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
            <AlertDialogAction onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}>
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
