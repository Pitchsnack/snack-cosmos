import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS } from "@/lib/sectors";
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
  todayIso,
  type ListedCompany,
  type ListedCompanyInput,
  type MarketTab,
} from "@/lib/listed-companies";
import {
  deleteListedCompany,
  importListedCompanies,
  saveListedCompany,
} from "@/lib/listed-companies.functions";

const MARKET_PILL: Record<MarketTab, string> = {
  all: "bg-muted text-foreground border-border",
  SET: "bg-info/10 text-info border-info/30",
  mai: "bg-success/10 text-success border-success/30",
};

const NO_SECTOR = "__none__";

/** Metric columns, in table order. Empty input clears to null — never zero. */
const METRIC_KEYS = ["revenueThbM", "ebitdaMarginPct", "evEbitda", "pe", "pbv"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const toDraft = (c: ListedCompany): ListedCompanyInput & { id: string } => ({
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
  statementPeriod: c.statementPeriod,
  tag: c.tag,
  asAt: c.asAt,
});


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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // ---- inline row editing -------------------------------------------------
  const saveRowFn = useServerFn(saveListedCompany);
  const [draft, setDraft] = useState<(ListedCompanyInput & { id: string }) | null>(null);
  const [dateTouched, setDateTouched] = useState(false);

  const startEdit = (c: ListedCompany) => {
    setDraft(toDraft(c));
    setDateTouched(false);
  };
  const cancelEdit = () => {
    setDraft(null);
    setDateTouched(false);
  };

  const saveRow = useMutation({
    mutationFn: (d: ListedCompanyInput & { id: string }) =>
      saveRowFn({
        data: {
          id: d.id,
          ticker: d.ticker,
          name: d.name.trim(),
          market: d.market,
          sector: d.sector,
          revenueThbM: d.revenueThbM,
          ebitdaMarginPct: d.ebitdaMarginPct,
          evEbitda: d.evEbitda,
          pe: d.pe,
          pbv: d.pbv,
          statementPeriod: d.statementPeriod,
          tag: d.tag,
          asAt: d.asAt,

        },
      }),
    onSuccess: () => {
      toast.success("Company updated.");
      cancelEdit();
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
      qc.invalidateQueries({ queryKey: ["peer-sets"] });
      qc.invalidateQueries({ queryKey: ["peer-set"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      matchesTerm(search, c.ticker, c.name, c.tag) &&
      (sectorFilter === ALL_SECTORS || c.sector === sectorFilter),
  );

  const clearAll = () => {
    setSearch("");
    setSectorFilter(ALL_SECTORS);
  };

  // ---- multi-select -------------------------------------------------------
  const selectedCompanies = companies.filter((c) => selected.has(c.id));
  const selectedUsedIn = selectedCompanies.filter((c) => c.usedIn > 0).length;
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const someSelected = !allSelected && rows.some((c) => selected.has(c.id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Select-all acts on the rows currently visible. */
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((c) => next.delete(c.id));
      else rows.forEach((c) => next.add(c.id));
      return next;
    });

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

  const bulkRemove = useMutation({
    mutationFn: async (ids: string[]) => {
      let done = 0;
      for (const id of ids) {
        await deleteFn({ data: { id } });
        done += 1;
      }
      return done;
    },
    onSuccess: (n) => {
      toast.success(`${n} compan${n === 1 ? "y" : "ies"} removed.`);
      setBulkOpen(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
      qc.invalidateQueries({ queryKey: ["peer-sets"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["listed-companies"] });
    },
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
          placeholder="Search ticker, company or tag…"
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

      {selectedCompanies.length > 0 && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedCompanies.length} selected
            {selectedUsedIn > 0 && (
              <span className="ml-2 text-xs font-normal text-warning">
                {selectedUsedIn} used in peer sets
              </span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => setBulkOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

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
              <th className="w-10 px-3 py-2.5 text-left">
                <Checkbox
                  aria-label="Select all companies"
                  className="border-white/60 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[hsl(222_47%_23%)]"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="w-24 px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="Ticker"
                  options={colOptions.ticker}
                  selected={valueFilters.ticker ?? []}
                  onChange={(v) => setValueFilter("ticker", v)}
                />
              </th>
              <th className="px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="Company"
                  options={colOptions.name}
                  selected={valueFilters.name ?? []}
                  onChange={(v) => setValueFilter("name", v)}
                />
              </th>
              <th className="w-20 px-3 py-2.5 text-center">
                <ValueColumnFilter
                  label="Market"
                  align="center"
                  options={colOptions.market}
                  selected={valueFilters.market ?? []}
                  onChange={(v) => setValueFilter("market", v)}
                />
              </th>
              <th className="w-44 px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="Sector"
                  options={colOptions.sector}
                  selected={valueFilters.sector ?? []}
                  onChange={(v) => setValueFilter("sector", v)}
                />
              </th>
              {NUMERIC_COLUMNS.map(({ key, label }) => (
                <th key={key} className="w-28 px-3 py-2.5 text-right">
                  <RangeColumnFilter
                    label={label}
                    value={rangeFilters[key] ?? { min: null, max: null }}
                    onChange={(v) => setRangeFilter(key, v)}
                  />
                </th>
              ))}
              <th className="w-20 px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="Period"
                  options={colOptions.statementPeriod}
                  selected={valueFilters.statementPeriod ?? []}
                  onChange={(v) => setValueFilter("statementPeriod", v)}
                />
              </th>
              <th className="w-40 px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="Tag"
                  options={colOptions.tag}
                  selected={valueFilters.tag ?? []}
                  onChange={(v) => setValueFilter("tag", v)}
                />
              </th>
              <th className="w-24 px-3 py-2.5 text-left">
                <ValueColumnFilter
                  label="As at"
                  options={colOptions.asAt}
                  selected={valueFilters.asAt ?? []}
                  onChange={(v) => setValueFilter("asAt", v)}
                />
              </th>

              <th className="w-20 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">
                Used in
              </th>

              <th className="sticky right-0 z-20 w-24 bg-[hsl(222_47%_23%)] px-3 py-2.5 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-muted-foreground">
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
              rows.map((c) => {
                const d = draft && draft.id === c.id ? draft : null;

                if (d) {
                  // Any ratio moved -> As at follows to today, unless the user set it.
                  const setField = (patch: Partial<Omit<ListedCompanyInput, "id">>) =>
                    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
                  const setMetric = (key: MetricKey, raw: string) => {
                    const t = raw.trim();
                    const n = t === "" || t === "-" ? null : Number(t);
                    const value = n !== null && Number.isFinite(n) ? n : null;
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            [key]: value,
                            ...(dateTouched || value === c[key] ? {} : { asAt: todayIso() }),
                          }
                        : prev,
                    );
                  };
                  const keys = (e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (d.name.trim()) saveRow.mutate(d);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  };

                  return (
                    <Fragment key={c.id}>
                      {c.usedIn > 0 && (
                        <tr className="border-t border-warning/30">
                          <td colSpan={15} className="bg-warning/10 px-3 py-2">
                            <span className="flex items-center gap-2 text-xs text-warning-foreground">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                              <span>
                                <b className="font-semibold">
                                  Used in {c.usedIn} peer set{c.usedIn === 1 ? "" : "s"}
                                </b>{" "}
                                — changes apply to all of them.
                              </span>
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-border/50 bg-info/5" onKeyDown={keys}>
                        <td className="px-3 py-2" />
                        <td className="px-2 py-2">
                          <Input
                            value={d.ticker}
                            disabled
                            aria-label="Ticker (locked)"
                            className="h-8 cursor-not-allowed border-dashed text-muted-foreground"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            autoFocus
                            className="h-8"
                            value={d.name}
                            onChange={(e) => setField({ name: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={d.market}
                            onValueChange={(v) => setField({ market: v as ListedCompany["market"] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SET">SET</SelectItem>
                              <SelectItem value="mai">mai</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={d.sector ?? NO_SECTOR}
                            onValueChange={(v) =>
                              setField({ sector: v === NO_SECTOR ? null : v })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="No sector" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_SECTOR}>No sector</SelectItem>
                              {SECTORS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {METRIC_KEYS.map((k) => (
                          <td key={k} className="px-2 py-2">
                            <Input
                              inputMode="decimal"
                              placeholder="—"
                              className="h-8 text-right tabular-nums"
                              value={d[k] === null || d[k] === undefined ? "" : String(d[k])}
                              onChange={(e) => setMetric(k, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <Input
                            className="h-8"
                            placeholder="Dec-25"
                            value={d.statementPeriod ?? ""}
                            onChange={(e) =>
                              setField({ statementPeriod: e.target.value || null })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="h-8"
                            placeholder="e.g. Telecom"
                            value={d.tag ?? ""}
                            onChange={(e) => setField({ tag: e.target.value || null })}
                          />
                        </td>
                        <td className="px-2 py-2">

                          <Input
                            type="date"
                            className="h-8"
                            value={d.asAt ?? ""}
                            onChange={(e) => {
                              setDateTouched(true);
                              setField({ asAt: e.target.value || null });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{c.usedIn}</td>
                        <td className="sticky right-0 z-10 bg-info/5 px-2 py-2 text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                          <Button
                            size="sm"
                            className="h-7 px-3"
                            disabled={!d.name.trim() || saveRow.isPending}
                            onClick={() => saveRow.mutate(d)}
                          >
                            {saveRow.isPending ? "Saving…" : "Save"}
                          </Button>
                        </td>
                      </tr>
                      <tr className="bg-info/5">
                        <td colSpan={15} className="px-3 pb-2.5">
                          <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <span>
                              Enter saves · Escape cancels · empty clears a value to null, it does
                              not set zero
                            </span>
                            {!dateTouched && d.asAt !== c.asAt && (
                              <span className="ml-auto font-semibold text-info">
                                As at updated to today automatically
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-t border-border/50 hover:bg-muted/40",
                      selected.has(c.id) && "bg-info/5",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={selected.has(c.id)}
                        aria-label={`Select ${c.ticker}`}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                    </td>
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
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {c.statementPeriod ?? EMPTY_CELL}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground" title={c.tag ?? undefined}>
                      <span className="block max-w-[190px] truncate">{c.tag ?? EMPTY_CELL}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.asAt ?? EMPTY_CELL}</td>

                    <td className="px-3 py-2.5 text-center tabular-nums">{c.usedIn}</td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-2.5 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${c.ticker}`}
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${c.ticker}`}
                          onClick={() => setPendingDelete(c)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCompanies.length} compan
              {selectedCompanies.length === 1 ? "y" : "ies"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUsedIn > 0 ? (
                <>
                  {selectedUsedIn} of them {selectedUsedIn === 1 ? "is" : "are"} used in peer sets.
                  Deleting removes them from those sets and changes every valuation that relies on
                  them.
                </>
              ) : (
                <>None of them are used in a peer set.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRemove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkRemove.isPending}
              onClick={(e) => {
                e.preventDefault();
                bulkRemove.mutate(selectedCompanies.map((c) => c.id));
              }}
            >
              {bulkRemove.isPending ? "Deleting…" : "Delete selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
