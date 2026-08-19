import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Info } from "lucide-react";
import { BulkBar, ControlPagination, FilterSelect, StatusTabs } from "./control-toolbar";
import { DirectoryStateBadge } from "./badges";
import { useControlFacets, useControlStartups, useSetDirectoryState } from "@/hooks/use-entity-control";
import { useDebounced } from "@/hooks/use-debounced";
import type { ControlListParams } from "@/lib/entity-control/types";

export function StartupControlTab() {
  const [status, setStatus] = useState<"all" | "published" | "unpublished">("all");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [industry, setIndustry] = useState<string | undefined>();
  const [country, setCountry] = useState<string | undefined>();
  const [updated, setUpdated] = useState<ControlListParams["updated"]>("any");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);

  const facets = useControlFacets();
  const params: ControlListParams = useMemo(
    () => ({
      page,
      pageSize,
      q: debouncedQ || undefined,
      status,
      facet: industry,
      country,
      updated,
      sort: "updated_desc",
    }),
    [page, pageSize, debouncedQ, status, industry, country, updated],
  );
  const { data, isLoading, isFetching } = useControlStartups(params);
  const setState = useSetDirectoryState();
  const rows = data?.rows ?? [];

  const reset = () => {
    setQ("");
    setIndustry(undefined);
    setCountry(undefined);
    setUpdated("any");
    setStatus("all");
    setPage(1);
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulk = async (state: "published" | "unpublished") => {
    await setState.mutateAsync({ entity: "startup", ids: selected, state });
    setSelected([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Published startups are visible in the Startup Directory. Unpublished startups remain internal
        to Control.
      </div>

      <StatusTabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} counts={{ all: data?.total }} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[18rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search startup name, website, founder, industry…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <FilterSelect
          label="Industry"
          value={industry}
          options={(facets.data?.industries ?? []).map((v) => ({ value: v, label: v }))}
          onChange={(v) => { setIndustry(v); setPage(1); }}
        />
        <FilterSelect
          label="HQ / Location"
          value={country}
          options={(facets.data?.startupCountries ?? []).map((v) => ({ value: v, label: v }))}
          onChange={(v) => { setCountry(v); setPage(1); }}
        />
        <FilterSelect
          label="Last Updated"
          value={updated === "any" ? undefined : updated}
          options={[
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "90d", label: "Last 90 days" },
          ]}
          onChange={(v) => { setUpdated((v as ControlListParams["updated"]) ?? "any"); setPage(1); }}
          width="w-36"
        />
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
        {isFetching && <span className="text-xs text-muted-foreground">Searching…</span>}
      </div>

      <BulkBar count={selected.length}>
        <Button size="sm" variant="outline" disabled={!selected.length || setState.isPending} onClick={() => bulk("published")}>
          Publish
        </Button>
        <Button size="sm" variant="outline" disabled={!selected.length || setState.isPending} onClick={() => bulk("unpublished")}>
          Unpublish
        </Button>
        <Button size="sm" variant="outline" disabled={!selected.length}>
          Export
        </Button>
      </BulkBar>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[2.5rem_minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_8rem_11rem] items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span />
          <span>Startup</span>
          <span>Industry</span>
          <span>HQ / Location</span>
          <span>Last Updated</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading && rows.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3">
              <Skeleton className="h-6 w-full" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            <p>No {status === "all" ? "" : status} startups found. Try adjusting your filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
              Reset filters
            </Button>
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid h-14 grid-cols-[2.5rem_minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_8rem_11rem] items-center gap-3 border-b border-border px-4 text-sm last:border-0 hover:bg-muted/40"
            >
              <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} />
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.short_description ?? "—"}</div>
              </div>
              <span className="truncate text-muted-foreground">{r.industry[0] ?? "—"}</span>
              <span className="truncate text-muted-foreground">{r.location ?? "—"}</span>
              <span className="truncate text-muted-foreground">
                {new Date(r.updated_at).toLocaleDateString()}
              </span>
              <DirectoryStateBadge state={r.directory_state} />
              <div className="flex items-center justify-end gap-1">
                <Button asChild size="sm" variant="ghost">
                  <Link to="/startups/$id/edit" params={{ id: r.id }} search={{ from: "entity-control", tab: "startups" }}>
                    Edit
                  </Link>
                </Button>
                {r.directory_state === "published" ? (
                  <Button size="sm" variant="outline" onClick={() => setState.mutate({ entity: "startup", ids: [r.id], state: "unpublished" })}>
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => setState.mutate({ entity: "startup", ids: [r.id], state: "published" })}
                  >
                    Publish
                  </Button>
                )}
              </div>
            </div>
          ))
        )}

        <ControlPagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPage={setPage}
          onPageSize={(n) => { setPageSize(n); setPage(1); }}
        />
      </div>
    </div>
  );
}
