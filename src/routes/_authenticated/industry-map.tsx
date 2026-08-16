import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Network, List, Table2, Search, RotateCcw, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/components/permission-guard";
import { useStartups } from "@/hooks/use-startups";
import { SimilarityCanvas } from "@/components/similarity-map/similarity-canvas";
import { MapInfoPanel } from "@/components/similarity-map/map-info-panel";
import {
  SIMILARITY_MODES,
  buildClusters,
  similarTo,
  type SimilarityMode,
} from "@/lib/similarity-map/similarity";
import type { StartupListItem } from "@/lib/startups.functions";
import { cn } from "@/lib/utils";

const MODES = ["industry", "product", "market", "all"] as const;
const VIEWS = ["map", "clusters", "table"] as const;
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Other"];
const REGIONS = ["APAC", "EMEA", "LATAM", "NA"];

const searchSchema = z.object({
  q: z.string().optional(),
  mode: z.enum(MODES).optional(),
  view: z.enum(VIEWS).optional(),
  industry: z.string().optional(),
  ptag: z.string().optional(),
  mtag: z.string().optional(),
  stage: z.string().optional(),
  region: z.string().optional(),
  selected: z.string().optional(),
  th: z.coerce.number().min(0).max(100).optional(),
});

export const Route = createFileRoute("/_authenticated/industry-map")({
  head: () => ({
    meta: [
      { title: "Industry, Product & Market Map — SnackPortal2" },
      {
        name: "description",
        content:
          "Explore startups grouped by similarities across Industry, Product & Service Tags, and Market Tags.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: () => (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <IndustryMapPage />
    </PermissionGuard>
  ),
});

function IndustryMapPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/industry-map" });
  const mode: SimilarityMode = s.mode ?? "industry";
  const view = s.view ?? "map";
  const threshold = (s.th ?? 70) / 100;
  const [query, setQuery] = useState(s.q ?? "");

  const set = (patch: Partial<typeof s>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const { data, isLoading } = useStartups({ scope: "directory", pageSize: 100, sort: "name_asc" });
  const all = useMemo(() => data?.items ?? [], [data]);

  const options = useMemo(() => {
    const ind = new Set<string>(), prod = new Set<string>(), mkt = new Set<string>();
    for (const r of all as StartupListItem[]) {
      (r.industry ?? []).forEach((t) => ind.add(t));
      (r.product_tags ?? []).forEach((t) => prod.add(t));
      (r.market_tags ?? []).forEach((t) => mkt.add(t));
    }
    const sorted = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b));
    return { industries: sorted(ind), products: sorted(prod), markets: sorted(mkt) };
  }, [all]);

  const rows = useMemo(() => {
    const q = (s.q ?? "").trim().toLowerCase();
    return (all as StartupListItem[]).filter((r) => {
      if (q && !r.startup_name.toLowerCase().includes(q)) return false;
      if (s.industry && !(r.industry ?? []).includes(s.industry)) return false;
      if (s.ptag && !(r.product_tags ?? []).includes(s.ptag)) return false;
      if (s.mtag && !(r.market_tags ?? []).includes(s.mtag)) return false;
      if (s.stage && r.investment_stage !== s.stage) return false;
      if (s.region && r.region !== s.region) return false;
      return true;
    });
  }, [all, s.q, s.industry, s.ptag, s.mtag, s.stage, s.region]);

  const clusters = useMemo(() => buildClusters(rows, mode), [rows, mode]);
  const selected = rows.find((r: StartupListItem) => r.id === s.selected) ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Industry, Product &amp; Market Map
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: "color-mix(in oklab, var(--map-accent) 40%, transparent)", background: "color-mix(in oklab, var(--map-accent) 10%, transparent)", color: "var(--map-accent)" }}>
              Discovery
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore startups grouped by similarities across Industry, Product &amp; Service Tags,
            and Market Tags.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuery("");
            navigate({ search: {} });
          }}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-card">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && set({ q: query || undefined })}
            onBlur={() => set({ q: query || undefined })}
            placeholder="Search startups…"
            className="h-9 pl-8"
          />
        </div>
        <FilterSelect
          label="Industry"
          value={s.industry}
          options={options.industries}
          onChange={(v) => set({ industry: v })}
        />
        <FilterSelect
          label="Product & Service"
          value={s.ptag}
          options={options.products}
          onChange={(v) => set({ ptag: v })}
        />
        <FilterSelect
          label="Market"
          value={s.mtag}
          options={options.markets}
          onChange={(v) => set({ mtag: v })}
        />
        <FilterSelect
          label="Stage"
          value={s.stage}
          options={STAGES}
          onChange={(v) => set({ stage: v })}
        />
        <FilterSelect
          label="Region"
          value={s.region}
          options={REGIONS}
          onChange={(v) => set({ region: v })}
        />
      </div>

      {/* View modes */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5">
          <ViewBtn active={view === "map"} onClick={() => set({ view: "map" })} icon={Network} label="Similarity Map" />
          <ViewBtn active={view === "clusters"} onClick={() => set({ view: "clusters" })} icon={List} label="Cluster List" />
          <ViewBtn active={view === "table"} onClick={() => set({ view: "table" })} icon={Table2} label="Table View" />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{rows.length} startups</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-px w-6" style={{ background: "var(--map-accent)" }} /> High Similarity
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-px w-6"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, color-mix(in oklab, var(--map-accent) 50%, transparent) 0 3px, transparent 3px 6px)",
              }}
            />
            Lower Similarity
          </span>
        </div>
      </div>

      {/* Similarity mode selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Tag View:</span>
        {SIMILARITY_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => set({ mode: m.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              mode === m.value
                ? "border-transparent text-[var(--map-accent-foreground)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
            style={mode === m.value ? { background: "var(--map-accent)" } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(640px,72fr)_minmax(300px,28fr)]">
        <div className="min-w-0 space-y-3">
          {isLoading ? (
            <Skeleton className="h-[680px] w-full rounded-2xl" />
          ) : view === "map" ? (
            <SimilarityCanvas
              clusters={clusters}
              rows={rows}
              mode={mode}
              threshold={threshold}
              selectedId={s.selected}
              onSelect={(id) => set({ selected: id })}
            />
          ) : view === "clusters" ? (
            <ClusterList clusters={clusters} onSelect={(id) => set({ selected: id })} />
          ) : (
            <TableView rows={rows} onSelect={(id) => set({ selected: id })} selectedId={s.selected} />
          )}

          {view === "map" && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 shadow-card">
              <span className="flex items-center gap-1 text-xs font-medium">
                Similarity Threshold
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
              <Slider
                value={[s.th ?? 70]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => set({ th: v })}
                className="max-w-[240px] flex-1"
              />
              <span className="text-xs tabular-nums text-muted-foreground">{s.th ?? 70}%</span>
            </div>
          )}
        </div>

        <div className="min-h-[540px] max-w-[420px]">
          {selected ? (
            <MapInfoPanel
              startup={selected}
              rows={rows}
              mode={mode}
              threshold={threshold}
              onSelect={(id) => set({ selected: id })}
              onClose={() => set({ selected: undefined })}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
              <Network className="mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">Select a startup</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click any node on the map to see its classifications and closest matches.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Select
      value={value ?? "__all"}
      onValueChange={(v) => onChange(v === "__all" ? undefined : v)}
    >
      <SelectTrigger className="h-9 w-[160px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="__all">All {label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ViewBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Network;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "text-[var(--map-accent-foreground)] shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
      style={active ? { background: "var(--map-accent)" } : undefined}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ClusterList({
  clusters,
  onSelect,
}: {
  clusters: ReturnType<typeof buildClusters>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {clusters.map((c) => (
        <section key={c.key} className="rounded-xl border border-border bg-card p-3 shadow-card">
          <header className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{c.name}</h3>
            <span className="text-xs text-muted-foreground">{c.members.length} startups</span>
          </header>
          <ul className="divide-y divide-border/60">
            {c.members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className="flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm hover:text-accent"
                >
                  <span className="truncate font-medium">{m.startup_name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[m.investment_stage, m.headquarters].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TableView({
  rows,
  onSelect,
  selectedId,
}: {
  rows: ReturnType<typeof buildClusters>[number]["members"];
  onSelect: (id: string) => void;
  selectedId?: string | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Startup</th>
            <th className="px-3 py-2 font-medium">Industry</th>
            <th className="px-3 py-2 font-medium">Product &amp; Service</th>
            <th className="px-3 py-2 font-medium">Market</th>
            <th className="px-3 py-2 font-medium">Stage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                "cursor-pointer border-t border-border/60 hover:bg-muted/30",
                selectedId === r.id && "bg-accent/10",
              )}
            >
              <td className="px-3 py-2 font-medium">{r.startup_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{(r.industry ?? []).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{(r.product_tags ?? []).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{(r.market_tags ?? []).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.investment_stage ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                No startups match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
