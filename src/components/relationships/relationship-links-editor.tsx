import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listInvestors } from "@/lib/investors.functions";
import { listStartups } from "@/lib/startups.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { cn } from "@/lib/utils";
import { investorStartupLinksAdapter } from "@/adapters/investorStartupLinksAdapter";
import type {
  DuplicateCandidate,
  InvestorStartupRelationshipType,
} from "@/adapters/investor-startup-links-types";
import { DuplicateWarningDialog } from "./duplicate-warning-dialog";

/**
 * Normalized row model the editor works with internally. Parent forms
 * translate to/from their DTO (`StartupInvestorLinkView` /
 * `InvestorPortfolioEntryView`) via `toRow` / `fromRow` mapping in the
 * hosting form component.
 */
export interface RelationshipRow {
  id: string;
  /** Real record id when linked; null for pending free-text rows. */
  refId: string | null;
  name: string;
  subtitle: string | null;
  /** Used for "Group by Industry" on the investor-side portfolio. */
  industry: string | null;
  relationshipType: InvestorStartupRelationshipType;
  status: "linked" | "pending";
}

type Mode = "investors" | "startups";

interface Props {
  mode: Mode;
  title: string;
  rows: RelationshipRow[];
  onChange: (rows: RelationshipRow[]) => void;
  /** Optional inline error surface — never causes local edits to be discarded. */
  errorMessage?: string | null;
}

const PORTFOLIO_TOOLBAR_THRESHOLD = 11;

const PLACEHOLDERS: Record<Mode, string> = {
  investors: "Search investors by name…",
  startups: "Search startups or companies by name…",
};

const EMPTY_STATE: Record<Mode, string> = {
  investors: "No investors linked yet. Search to link one, or add a pending name below.",
  startups: "No portfolio companies yet. Search to link one, or add a pending name below.",
};

function makePendingId() {
  return `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RelationshipLinksEditor({
  mode,
  title,
  rows,
  onChange,
  errorMessage,
}: Props) {
  const enabled = useHasSession();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDraft, setPendingDraft] = useState("");
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidate[]>([]);
  const [dupTypedName, setDupTypedName] = useState("");

  // Portfolio-side filter toolbar (investor-side only, ≥11 entries).
  type Filter = "all" | "investment" | "acquisition" | "pending";
  const [filter, setFilter] = useState<Filter>("all");
  const [groupByIndustry, setGroupByIndustry] = useState(false);

  // Debounce input at 200 ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ------- Read-only search via existing permission-guarded server fns -------
  const investorsFn = useServerFn(listInvestors);
  const startupsFn = useServerFn(listStartups);

  const investorsQ = useQuery({
    queryKey: ["rel-links-search", "investors", debouncedQuery],
    queryFn: () => investorsFn({ data: { search: debouncedQuery || undefined } }),
    enabled: enabled && mode === "investors" && debouncedQuery.length > 0,
    staleTime: 30_000,
  });

  const startupsQ = useQuery({
    queryKey: ["rel-links-search", "startups", debouncedQuery],
    queryFn: () => startupsFn({ data: { search: debouncedQuery || undefined, pageSize: 50 } }),
    enabled: enabled && mode === "startups" && debouncedQuery.length > 0,
    staleTime: 30_000,
  });

  const linkedRefIds = useMemo(
    () => new Set(rows.map((r) => r.refId).filter((v): v is string => !!v)),
    [rows],
  );

  const suggestions: RelationshipRow[] = useMemo(() => {
    if (mode === "investors") {
      const list = investorsQ.data ?? [];
      return list
        .filter((r) => !linkedRefIds.has(r.id))
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          refId: r.id,
          name: r.investor_name,
          subtitle: r.investor_type ?? null,
          industry: null,
          relationshipType: "investment" as const,
          status: "linked" as const,
        }));
    }
    const list = startupsQ.data?.items ?? [];
    return list
      .filter((r) => !linkedRefIds.has(r.id))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        refId: r.id,
        name: r.startup_name,
        subtitle: r.industry?.[0] ?? null,
        industry: r.industry?.[0] ?? null,
        relationshipType: "investment" as const,
        status: "linked" as const,
      }));
  }, [mode, investorsQ.data, startupsQ.data, linkedRefIds]);

  const isSearching =
    debouncedQuery.length > 0 &&
    (mode === "investors" ? investorsQ.isFetching : startupsQ.isFetching);

  const addRow = (row: RelationshipRow) => {
    onChange([...rows, row]);
    setQuery("");
    setDebouncedQuery("");
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  const setRelType = (id: string, next: InvestorStartupRelationshipType) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, relationshipType: next } : r)));
  };

  // ---- Pending creation with duplicate check ----

  const tryCreatePending = () => {
    const name = pendingDraft.trim();
    if (!name) return;
    const dup =
      mode === "investors"
        ? investorStartupLinksAdapter.checkInvestorDuplicates(
            name,
            (investorsQ.data ?? []).map((i) => ({
              id: i.id,
              investor_name: i.investor_name,
              investor_type: i.investor_type,
            })),
          )
        : investorStartupLinksAdapter.checkStartupDuplicates(
            name,
            (startupsQ.data?.items ?? []).map((s) => ({
              id: s.id,
              startup_name: s.startup_name,
              industry: s.industry ?? null,
            })),
          );

    if (dup.candidates.length > 0) {
      setDupCandidates(dup.candidates);
      setDupTypedName(name);
      setDupOpen(true);
      return;
    }

    commitPending(name);
  };

  const commitPending = (name: string) => {
    addRow({
      id: makePendingId(),
      refId: null,
      name,
      subtitle: null,
      industry: null,
      relationshipType: "investment",
      status: "pending",
    });
    setPendingDraft("");
    setDupOpen(false);
  };

  const linkCandidateFromDialog = (c: DuplicateCandidate) => {
    if (!c.id) { commitPending(c.name); return; }
    if (linkedRefIds.has(c.id)) { setDupOpen(false); return; }
    addRow({
      id: c.id,
      refId: c.id,
      name: c.name,
      subtitle: c.subtitle ?? null,
      industry: null,
      relationshipType: "investment",
      status: "linked",
    });
    setPendingDraft("");
    setDupOpen(false);
  };

  // ---- Filtered / grouped display (investor-side, ≥ threshold) ----

  const useToolbar = mode === "startups" && rows.length >= PORTFOLIO_TOOLBAR_THRESHOLD;

  const filteredRows = useMemo(() => {
    if (!useToolbar) return rows;
    switch (filter) {
      case "investment": return rows.filter((r) => r.status === "linked" && r.relationshipType === "investment");
      case "acquisition": return rows.filter((r) => r.status === "linked" && r.relationshipType === "acquisition");
      case "pending": return rows.filter((r) => r.status === "pending");
      default: return rows;
    }
  }, [rows, filter, useToolbar]);

  const grouped: Array<{ label: string; items: RelationshipRow[] }> = useMemo(() => {
    if (!useToolbar || !groupByIndustry) return [{ label: "", items: filteredRows }];
    const map = new Map<string, RelationshipRow[]>();
    for (const r of filteredRows) {
      const k = r.industry?.trim() || "Uncategorized";
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({ label, items }));
  }, [filteredRows, useToolbar, groupByIndustry]);

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {title}
          {useToolbar && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} total
            </span>
          )}
        </h3>
      </div>

      {/* Toolbar (investor-side portfolio, ≥11 entries) */}
      {useToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "investment", "acquisition", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Group by Industry</Label>
            <input
              type="checkbox"
              checked={groupByIndustry}
              onChange={(e) => setGroupByIndustry(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </div>
      )}

      {/* Search combobox */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
            className="pl-8"
          />
        </div>
        {debouncedQuery.length > 0 && (
          <div className="rounded-md border border-border bg-card">
            {isSearching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
            )}
            {!isSearching && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
            )}
            <ul className="max-h-56 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => addRow(s)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">{s.name}</span>
                    {s.subtitle && (
                      <span className="ml-2 shrink-0 truncate text-xs text-muted-foreground">
                        {s.subtitle}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pending free-text add */}
      <div className="flex gap-2">
        <Input
          value={pendingDraft}
          onChange={(e) => setPendingDraft(e.target.value)}
          placeholder={
            mode === "investors"
              ? "Add pending investor name…"
              : "Add pending company name…"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); tryCreatePending(); }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={tryCreatePending}
          disabled={!pendingDraft.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Pending
        </Button>
      </div>

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{EMPTY_STATE[mode]}</p>
      ) : (
        <div className="space-y-3">
          {grouped.map((group, gi) => (
            <div key={group.label + gi} className="space-y-2">
              {group.label && (
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {group.items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 pl-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{r.name}</span>
                        {r.status === "pending" && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </div>
                      {r.subtitle && (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {r.subtitle}
                        </div>
                      )}
                    </div>
                    <Select
                      value={r.relationshipType}
                      onValueChange={(v) => setRelType(r.id, v as InvestorStartupRelationshipType)}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="investment">Investment</SelectItem>
                        <SelectItem value="acquisition">Acquisition</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${r.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <DuplicateWarningDialog
        open={dupOpen}
        typedName={dupTypedName}
        candidates={dupCandidates}
        onCancel={() => setDupOpen(false)}
        onLinkExisting={linkCandidateFromDialog}
        onCreatePendingAnyway={() => commitPending(dupTypedName)}
      />
    </section>
  );
}
