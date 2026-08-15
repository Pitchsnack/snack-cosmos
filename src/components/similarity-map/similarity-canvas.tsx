import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const W = 1500;
const H_DEFAULT = 980;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.4;

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

interface NodePos {
  id: string;
  x: number;
  y: number;
  r: number;
  ci: number;
  startup: StartupListItem;
}

interface Blob {
  key: string;
  name: string;
  count: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  ci: number;
}

/** Deterministic pseudo-random in [0,1) from a string key. */
function hash01(key: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function layout(clusters: Cluster[], H: number) {
  const n = clusters.length;
  const blobs: Blob[] = [];
  const nodes: NodePos[] = [];
  if (n === 0) return { blobs, nodes, scale: 1 };

  const NODE_R = 30;
  const RING_GAP = 92;
  const GAP = 32; // visual separation between neighbouring clusters

  type Pack = { rad: number; local: { x: number; y: number }[] };
  const packs: Pack[] = clusters.map((c) => {
    const count = c.members.length;
    const local: { x: number; y: number }[] = [];
    let idx = 0;
    let ring = 0;
    while (idx < count) {
      const ringR = ring * RING_GAP;
      const cap =
        ring === 0 ? 1 : Math.max(1, Math.floor((2 * Math.PI * ringR) / (NODE_R * 2.7)));
      const take = Math.min(cap, count - idx);
      for (let k = 0; k < take; k++) {
        const a = (k / take) * Math.PI * 2 + hash01(c.key, ring + 11) * Math.PI;
        local.push({ x: Math.cos(a) * ringR, y: Math.sin(a) * ringR });
      }
      idx += take;
      ring += 1;
      if (ring > 12) break;
    }
    const spanR = local.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0);
    return { rad: spanR + NODE_R + 40, local };
  });

  // Balanced grid placement — clusters spread evenly across the canvas
  // instead of a sparse spiral with large dead zones.
  const aspect = W / H;
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect))));
  const rows = Math.ceil(n / cols);
  const cellW = Math.max(...packs.map((p) => p.rad)) * 2 + GAP;
  const cellH = cellW;

  clusters.forEach((c, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    // centre each row so partial rows stay balanced
    const x = (col - (inRow - 1) / 2) * cellW + W / 2;
    const y = (row - (rows - 1) / 2) * cellH + H / 2;
    const p = packs[i]!;

    blobs.push({
      key: c.key,
      name: c.name,
      count: c.members.length,
      cx: x,
      cy: y,
      rx: p.rad * (1.06 + hash01(c.key, 1) * 0.12),
      ry: p.rad * (0.96 + hash01(c.key, 2) * 0.12),
      rot: hash01(c.key, 3) * 30 - 15,
      ci: i,
    });

    p.local.forEach((lp, k) => {
      const m = c.members[k]!;
      nodes.push({ id: m.id, x: x + lp.x, y: y + lp.y, r: NODE_R, ci: i, startup: m });
    });
  });

  // fit everything into ~88% of the canvas box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of blobs) {
    minX = Math.min(minX, b.cx - b.rx);
    maxX = Math.max(maxX, b.cx + b.rx);
    minY = Math.min(minY, b.cy - b.ry - 46);
    maxY = Math.max(maxY, b.cy + b.ry + 24);
  }
  const usable = 0.88;
  const scale = Math.min(
    (W * usable) / Math.max(1, maxX - minX),
    (H * usable) / Math.max(1, maxY - minY),
    3.2,
  );
  const dx = W / 2 - ((minX + maxX) / 2) * scale;
  const dy = H / 2 - ((minY + maxY) / 2) * scale;
  const map = (v: number, d: number) => v * scale + d;
  for (const b of blobs) {
    b.cx = map(b.cx, dx);
    b.cy = map(b.cy, dy);
    b.rx *= scale;
    b.ry *= scale;
  }
  for (const nd of nodes) {
    nd.x = map(nd.x, dx);
    nd.y = map(nd.y, dy);
    nd.r *= scale;
  }

  return { blobs, nodes, scale };
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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [vh, setVh] = useState(H_DEFAULT);
  const { blobs, nodes, scale: fit } = useMemo(() => layout(clusters, vh), [clusters, vh]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // auto-fit: reset pan/zoom whenever the visible cluster set changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [clusters]);


  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  /** Ambient cluster-to-cluster links (faint, dotted). */
  const clusterLinks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < blobs.length; i++) {
      const dists = blobs
        .map((b, j) => ({ j, d: Math.hypot(b.cx - blobs[i]!.cx, b.cy - blobs[i]!.cy) }))
        .filter((v) => v.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      for (const { j } of dists) {
        if (j < i) continue;
        out.push({ x1: blobs[i]!.cx, y1: blobs[i]!.cy, x2: blobs[j]!.cx, y2: blobs[j]!.cy });
      }
    }
    return out;
  }, [blobs]);

  /** Similarity edges from the selected startup. */
  const edges = useMemo(() => {
    if (!selected) return [] as { to: NodePos; score: number }[];
    const out: { to: NodePos; score: number }[] = [];
    for (const r of rows) {
      if (r.id === selected.id) continue;
      const score = similarity(selected, r, mode);
      if (score >= threshold && score > 0) {
        const to = nodeById.get(r.id);
        if (to) out.push({ to, score });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [selected, rows, mode, threshold, nodeById]);

  const neighbourIds = useMemo(
    () => new Set(edges.map((e) => e.to.id)),
    [edges],
  );

  const anchor = selectedId ? nodeById.get(selectedId) : undefined;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const k = clamped / zoomRef.current;
    zoomRef.current = clamped;
    setZoom(clamped);
    setOffset((o) => ({ x: px - (px - o.x) * k, y: py - (py - o.y) * k }));
  }, []);


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) setVh(Math.round((W * r.height) / r.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      zoomAt(
        zoomRef.current * Math.exp(-dy * 0.0015),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const zoomButton = (dir: 1 | -1) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    zoomAt(zoom * (dir === 1 ? 1.2 : 1 / 1.2), (rect?.width ?? W) / 2, (rect?.height ?? 600) / 2);
  };

  return (
    <TooltipProvider>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[var(--map-surface)] shadow-card">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:26px_26px] opacity-40" />

        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-border bg-background/90 p-0.5 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom out" onClick={() => zoomButton(-1)}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom in" onClick={() => zoomButton(1)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Reset map"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative h-[68vh] max-h-[820px] min-h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerLeave={() => {
            drag.current = null;
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${W} ${vh}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
              {/* cluster bubbles */}
              {blobs.map((b) => {
                const active = !!anchor && anchor.ci === b.ci;
                return (
                  <g key={b.key} transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}>
                    <ellipse
                      cx={b.cx}
                      cy={b.cy}
                      rx={b.rx}
                      ry={b.ry}
                      fill={`color-mix(in oklab, ${clusterColor(b.ci)} ${active ? 16 : 10}%, var(--card))`}
                      stroke={`color-mix(in oklab, ${clusterColor(b.ci)} ${active ? 55 : 26}%, transparent)`}
                      strokeWidth={active ? 2 : 1.25}
                    />
                  </g>
                );
              })}

              {/* ambient links between clusters */}
              {clusterLinks.map((l, i) => (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="var(--map-accent)"
                  strokeOpacity={0.28}
                  strokeWidth={1.4 * Math.min(fit, 2)}
                  strokeDasharray="6 8"
                />
              ))}

              {/* similarity edges from the selected startup */}
              {anchor &&
                edges.map((e) => {
                  const strong = e.score >= Math.max(threshold, 0.6);
                  const medium = !strong && e.score >= Math.max(threshold, 0.35);
                  const mx = (anchor.x + e.to.x) / 2;
                  const my = (anchor.y + e.to.y) / 2 - Math.abs(anchor.x - e.to.x) * 0.12;
                  const w = Math.min(fit, 2);
                  return (
                    <path
                      key={e.to.id}
                      d={`M ${anchor.x} ${anchor.y} Q ${mx} ${my} ${e.to.x} ${e.to.y}`}
                      fill="none"
                      stroke="var(--map-accent)"
                      strokeOpacity={strong ? 0.85 : medium ? 0.55 : 0.38}
                      strokeWidth={(strong ? 2.4 : medium ? 1.6 : 1.1) * w}
                      strokeDasharray={strong ? undefined : medium ? `${7 * w} ${5 * w}` : `${3 * w} ${6 * w}`}
                    />
                  );
                })}

            </g>
          </svg>

          {/* cluster labels + nodes in DOM, aligned to the same viewBox transform */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ containerType: "size" } as React.CSSProperties}
          >
            <svg className="h-full w-full" viewBox={`0 0 ${W} ${vh}`} preserveAspectRatio="xMidYMid meet">
              <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
                {blobs.map((b) => {
                  const s = Math.min(fit, 2.2);
                  return (
                    <g key={b.key}>
                      <circle
                        cx={b.cx - b.rx + 22 * s}
                        cy={b.cy - b.ry - 16 * s}
                        r={4.5 * s}
                        fill={clusterColor(b.ci)}
                      />
                      <text
                        x={b.cx - b.rx + 34 * s}
                        y={b.cy - b.ry - 11 * s}
                        fontSize={15 * s}
                        fontWeight={600}
                        fill="var(--foreground)"
                      >
                        {b.name}
                      </text>
                      <text
                        x={b.cx - b.rx + 34 * s}
                        y={b.cy - b.ry + 6 * s}
                        fontSize={11 * s}
                        fill="var(--muted-foreground)"
                      >
                        {b.count} startups
                      </text>
                    </g>
                  );
                })}


                {nodes.map((n) => {
                  const isSel = n.id === selectedId;
                  const isNb = neighbourIds.has(n.id);
                  const dim = !!anchor && !isSel && !isNb;
                  const r = isSel ? n.r * 1.45 : n.r;
                  return (
                    <Tooltip key={n.id} delayDuration={120}>
                      <TooltipTrigger asChild>
                        <g
                          className="pointer-events-auto cursor-pointer"
                          opacity={dim ? 0.42 : 1}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onSelect(n.id);
                          }}
                        >
                          {isSel && (
                            <circle
                              cx={n.x}
                              cy={n.y}
                              r={r + 10}
                              fill="color-mix(in oklab, var(--map-accent) 18%, transparent)"
                            />
                          )}
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={r}
                            fill="var(--card)"
                            stroke={
                              isSel
                                ? "var(--map-accent)"
                                : isNb
                                  ? "color-mix(in oklab, var(--map-accent) 45%, transparent)"
                                  : `color-mix(in oklab, ${clusterColor(n.ci)} 45%, transparent)`
                            }
                            strokeWidth={isSel ? 3 : 1.5}
                          />
                          {n.startup.logo_signed_url ? (
                            <>
                              <clipPath id={`clip-${n.id}`}>
                                <circle cx={n.x} cy={n.y} r={r - 3} />
                              </clipPath>
                              <image
                                href={n.startup.logo_signed_url}
                                x={n.x - (r - 3)}
                                y={n.y - (r - 3)}
                                width={(r - 3) * 2}
                                height={(r - 3) * 2}
                                clipPath={`url(#clip-${n.id})`}
                                preserveAspectRatio="xMidYMid slice"
                              />
                            </>
                          ) : (
                            <text
                              x={n.x}
                              y={n.y + 4}
                              textAnchor="middle"
                              fontSize={11}
                              fontWeight={600}
                              fill="var(--muted-foreground)"
                            >
                              {monogram(n.startup.startup_name)}
                            </text>
                          )}
                          <text
                            x={n.x}
                            y={n.y + r + 13}
                            textAnchor="middle"
                            fontSize={10.5}
                            fontWeight={isSel ? 700 : 500}
                            fill={isSel ? "var(--map-accent)" : "var(--foreground)"}
                          >
                            {n.startup.startup_name.length > 16
                              ? `${n.startup.startup_name.slice(0, 15)}…`
                              : n.startup.startup_name}
                          </text>
                        </g>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs space-y-1">
                        <p className="font-semibold">{n.startup.startup_name}</p>
                        {n.startup.industry?.length ? (
                          <p>Industry: {n.startup.industry.join(", ")}</p>
                        ) : null}
                        {n.startup.product_tags?.length ? (
                          <p>Product &amp; Service: {n.startup.product_tags.join(", ")}</p>
                        ) : null}
                        {n.startup.market_tags?.length ? (
                          <p>Market: {n.startup.market_tags.join(", ")}</p>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </g>
            </svg>
          </div>

          {clusters.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No startups match the current filters.
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
