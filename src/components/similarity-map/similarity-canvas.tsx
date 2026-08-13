import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StartupListItem } from "@/lib/startups.functions";
import { type Cluster, type SimilarityMode, similarity } from "@/lib/similarity-map/similarity";
import { cn } from "@/lib/utils";

const NODE_LIMIT = 5;

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function clusterColor(index: number) {
  return `var(--cluster-${(index % 8) + 1})`;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strong: boolean;
}

export function SimilarityCanvas({
  clusters,
  rows,
  mode,
  threshold,
  selectedId,
  onSelect,
}: {
  clusters: Cluster[];
  rows: StartupListItem[];
  mode: SimilarityMode;
  threshold: number;
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const neighbourScores = useMemo(() => {
    const map = new Map<string, number>();
    if (!selected) return map;
    for (const r of rows) {
      if (r.id === selected.id) continue;
      const score = similarity(selected, r, mode);
      if (score >= threshold && score > 0) map.set(r.id, score);
    }
    return map;
  }, [rows, selected, mode, threshold]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !selected) {
      setLines([]);
      return;
    }
    const compute = () => {
      const base = surface.getBoundingClientRect();
      const anchor = nodeRefs.current.get(selected.id);
      if (!anchor) {
        setLines([]);
        return;
      }
      const a = anchor.getBoundingClientRect();
      const ax = (a.left + a.width / 2 - base.left) / zoom;
      const ay = (a.top + a.height / 2 - base.top) / zoom;
      const next: Line[] = [];
      neighbourScores.forEach((score, id) => {
        const el = nodeRefs.current.get(id);
        if (!el) return;
        const b = el.getBoundingClientRect();
        next.push({
          x1: ax,
          y1: ay,
          x2: (b.left + b.width / 2 - base.left) / zoom,
          y2: (b.top + b.height / 2 - base.top) / zoom,
          strong: score >= Math.max(threshold, 0.5),
        });
      });
      setLines(next);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [selected, neighbourScores, zoom, threshold, clusters, expanded]);

  const registerNode = (id: string) => (el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  };

  return (
    <TooltipProvider>
      <div className="relative rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-background/90 p-0.5 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Reset map"
            onClick={() => {
              setZoom(1);
              setExpanded({});
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="overflow-auto">
          <div
            ref={surfaceRef}
            className="relative origin-top-left transition-transform duration-150"
            style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {lines.map((l, i) => (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={l.strong ? 0.55 : 0.28}
                  strokeWidth={l.strong ? 1.5 : 1}
                  strokeDasharray={l.strong ? undefined : "4 4"}
                />
              ))}
            </svg>

            <div className="relative grid grid-cols-1 gap-4 pt-8 sm:grid-cols-2 xl:grid-cols-3">
              {clusters.map((cluster, ci) => {
                const isOpen = expanded[cluster.key] ?? false;
                const visible = isOpen ? cluster.members : cluster.members.slice(0, NODE_LIMIT);
                const rest = cluster.members.length - visible.length;
                const clusterSelected =
                  !!selected && cluster.members.some((m) => m.id === selected.id);
                return (
                  <section
                    key={cluster.key}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      clusterSelected ? "border-transparent" : "border-border/60",
                    )}
                    style={{
                      background: `color-mix(in oklab, ${clusterColor(ci)} 8%, var(--card))`,
                      borderColor: clusterSelected
                        ? `color-mix(in oklab, ${clusterColor(ci)} 55%, transparent)`
                        : undefined,
                    }}
                  >
                    <header className="mb-2 flex items-baseline gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: clusterColor(ci) }}
                      />
                      <h3 className="truncate text-sm font-semibold">{cluster.name}</h3>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {cluster.members.length} startups
                      </span>
                    </header>
                    <div className="flex flex-wrap gap-2">
                      {visible.map((s) => {
                        const isSel = s.id === selected?.id;
                        const isNeighbour = neighbourScores.has(s.id);
                        return (
                          <Tooltip key={s.id} delayDuration={150}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                ref={registerNode(s.id)}
                                onClick={() => onSelect(s.id)}
                                className={cn(
                                  "flex w-[86px] flex-col items-center gap-1 rounded-lg border bg-card px-1.5 py-2 text-center transition-all",
                                  isSel
                                    ? "border-accent ring-2 ring-accent/50"
                                    : isNeighbour
                                      ? "border-accent/40"
                                      : "border-border/60 hover:border-accent/50",
                                )}
                              >
                                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                                  {s.logo_signed_url ? (
                                    <img
                                      src={s.logo_signed_url}
                                      alt=""
                                      className="h-full w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                      {monogram(s.startup_name)}
                                    </span>
                                  )}
                                </span>
                                <span className="line-clamp-2 text-[11px] font-medium leading-tight">
                                  {s.startup_name}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs space-y-1">
                              <p className="font-semibold">{s.startup_name}</p>
                              {s.industry?.length ? <p>Industry: {s.industry.join(", ")}</p> : null}
                              {s.product_tags?.length ? (
                                <p>Product &amp; Service: {s.product_tags.join(", ")}</p>
                              ) : null}
                              {s.market_tags?.length ? (
                                <p>Market: {s.market_tags.join(", ")}</p>
                              ) : null}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {rest > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((e) => ({ ...e, [cluster.key]: true }))
                          }
                          className="flex h-[70px] w-[52px] items-center justify-center rounded-lg border border-dashed border-border bg-card text-xs font-medium text-muted-foreground hover:border-accent/60 hover:text-foreground"
                        >
                          +{rest}
                        </button>
                      )}
                      {isOpen && cluster.members.length > NODE_LIMIT && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((e) => ({ ...e, [cluster.key]: false }))
                          }
                          className="flex h-[70px] w-[52px] items-center justify-center rounded-lg border border-dashed border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          Less
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
              {clusters.length === 0 && (
                <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  No startups match the current filters.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
