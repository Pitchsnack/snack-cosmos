import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StartupListItem } from "@/lib/startups.functions";
import { type Cluster, type SimilarityMode, similarity } from "@/lib/similarity-map/similarity";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.4;
const NODE_SIZE = 44;
const NODE_GAP = 16;
const NODE_CELL_HEIGHT = 68;
const CLUSTER_PADDING = 20;
const CLUSTER_HEADER = 30;
const CLUSTER_GAP = 32;
const OUTER_MARGIN = 32;
const HERO_WIDTH = 300;
const HERO_HEIGHT = 92;
const HERO_HALO = 48;

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function shortName(name: string) {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

function clusterColor(index: number) {
  return `var(--cluster-${(index % 8) + 1})`;
}

interface ClusterBox {
  key: string;
  name: string;
  count: number;
  ci: number;
  x: number;
  y: number;
  width: number;
  height: number;
  displayMembers: StartupListItem[];
  overflow: number;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
  ci: number;
  startup: StartupListItem;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function measureCluster(cluster: Cluster, ci: number): ClusterBox {
  const displayMembers = cluster.members.slice(0, 6);
  const overflow = Math.max(0, cluster.members.length - displayMembers.length);
  const itemCount = displayMembers.length + (overflow ? 1 : 0);
  const columns = Math.max(1, Math.ceil(Math.sqrt(itemCount)));
  const rows = Math.max(1, Math.ceil(itemCount / columns));
  const width = CLUSTER_PADDING * 2 + columns * NODE_SIZE + (columns - 1) * NODE_GAP;
  const height = CLUSTER_PADDING * 2 + CLUSTER_HEADER + rows * NODE_CELL_HEIGHT + (rows - 1) * NODE_GAP;
  return {
    key: cluster.key,
    name: cluster.name,
    count: cluster.members.length,
    ci,
    x: 0,
    y: 0,
    width,
    height,
    displayMembers,
    overflow,
  };
}

function placeGrid(boxes: ClusterBox[], selected: boolean) {
  if (!boxes.length) return boxes;
  const columns = selected
    ? boxes.length >= 10
      ? 5
      : boxes.length >= 4
        ? 3
        : 3
    : Math.max(1, Math.ceil(Math.sqrt(boxes.length)));
  const reservedIndex = selected ? Math.floor(columns / 2) : -1;
  const cellCount = boxes.length + (selected ? 1 : 0);
  const rows = Math.ceil(cellCount / columns);
  const centreRow = selected ? Math.floor(rows / 2) : -1;
  const centreIndex = selected ? centreRow * columns + reservedIndex : -1;
  const cells: Array<ClusterBox | null> = [];
  let boxIndex = 0;
  for (let i = 0; i < rows * columns; i += 1) {
    if (i === centreIndex) cells.push(null);
    else cells.push(boxes[boxIndex++] ?? null);
  }

  if (selected && boxes.length <= 3) {
    const positions =
      boxes.length === 1
        ? [{ x: 0, y: -(HERO_HEIGHT / 2 + HERO_HALO + CLUSTER_GAP) }]
        : boxes.length === 2
          ? [
              { x: -(HERO_WIDTH / 2 + HERO_HALO + CLUSTER_GAP), y: 0 },
              { x: HERO_WIDTH / 2 + HERO_HALO + CLUSTER_GAP, y: 0 },
            ]
          : [
              { x: -(HERO_WIDTH / 2 + HERO_HALO + CLUSTER_GAP), y: -(HERO_HEIGHT / 2 + HERO_HALO) },
              { x: HERO_WIDTH / 2 + HERO_HALO + CLUSTER_GAP, y: -(HERO_HEIGHT / 2 + HERO_HALO) },
              { x: 0, y: HERO_HEIGHT / 2 + HERO_HALO + CLUSTER_GAP },
            ];
    return boxes.map((box, index) => {
      const position = positions[index] ?? { x: 0, y: 0 };
      return { ...box, x: position.x - box.width / 2, y: position.y - box.height / 2 };
    });
  }

  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(
      selected && column === reservedIndex ? HERO_WIDTH + HERO_HALO * 2 : 0,
      ...cells.filter((_, index) => index % columns === column).map((box) => box?.width ?? 0),
    ),
  );
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(
      selected && row === centreRow ? HERO_HEIGHT + HERO_HALO * 2 : 0,
      ...cells.slice(row * columns, (row + 1) * columns).map((box) => box?.height ?? 0),
    ),
  );
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + CLUSTER_GAP * (columns - 1);
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + CLUSTER_GAP * (rows - 1);
  const columnStarts: number[] = [];
  const rowStarts: number[] = [];
  let cursor = -totalWidth / 2;
  for (const width of columnWidths) {
    columnStarts.push(cursor);
    cursor += width + CLUSTER_GAP;
  }
  cursor = -totalHeight / 2;
  for (const height of rowHeights) {
    rowStarts.push(cursor);
    cursor += height + CLUSTER_GAP;
  }

  return cells.flatMap((box, index) => {
    if (!box) return [];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (columnStarts[column] ?? 0) + ((columnWidths[column] ?? box.width) - box.width) / 2;
    const y = (rowStarts[row] ?? 0) + ((rowHeights[row] ?? box.height) - box.height) / 2;
    return [{ ...box, x, y }];
  });
}

function buildLayout(clusters: Cluster[], selected: boolean) {
  const boxes = placeGrid(clusters.map(measureCluster), selected);
  const nodes: NodePos[] = [];
  for (const box of boxes) {
    const itemCount = box.displayMembers.length + (box.overflow ? 1 : 0);
    const columns = Math.max(1, Math.ceil(Math.sqrt(itemCount)));
    const contentWidth = columns * NODE_SIZE + (columns - 1) * NODE_GAP;
    const startX = box.x + (box.width - contentWidth) / 2 + NODE_SIZE / 2;
    const startY = box.y + CLUSTER_PADDING + CLUSTER_HEADER + NODE_SIZE / 2;
    box.displayMembers.forEach((startup, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      nodes.push({
        id: startup.id,
        x: startX + column * (NODE_SIZE + NODE_GAP),
        y: startY + row * (NODE_CELL_HEIGHT + NODE_GAP),
        ci: box.ci,
        startup,
      });
    });
  }
  const extents = boxes.reduce<Bounds>(
    (bounds, box) => ({
      minX: Math.min(bounds.minX, box.x),
      minY: Math.min(bounds.minY, box.y),
      maxX: Math.max(bounds.maxX, box.x + box.width),
      maxY: Math.max(bounds.maxY, box.y + box.height),
    }),
    selected
      ? {
          minX: -HERO_WIDTH / 2 - HERO_HALO,
          minY: -HERO_HEIGHT / 2 - HERO_HALO,
          maxX: HERO_WIDTH / 2 + HERO_HALO,
          maxY: HERO_HEIGHT / 2 + HERO_HALO,
        }
      : { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const bounds = boxes.length
    ? {
        minX: extents.minX - OUTER_MARGIN,
        minY: extents.minY - OUTER_MARGIN,
        maxX: extents.maxX + OUTER_MARGIN,
        maxY: extents.maxY + OUTER_MARGIN,
      }
    : { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return { boxes, nodes, bounds };
}

function edgeStyle(score: number, threshold: number) {
  if (score >= Math.max(threshold, 0.6)) return { width: 2, opacity: 0.5, dash: undefined };
  if (score >= Math.max(threshold, 0.35)) return { width: 1.5, opacity: 0.35, dash: "6 4" };
  return { width: 1, opacity: 0.2, dash: "2 5" };
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
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const moved = useRef(false);
  const [size, setSize] = useState({ width: 1000, height: 680 });
  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const { boxes, nodes, bounds } = useMemo(() => buildLayout(clusters, !!selected), [clusters, selected]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const anchor = selected ? nodeById.get(selected.id) : undefined;
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const autoFit = Math.min(2.5, Math.max(0.4, Math.min((size.width * 0.88) / contentWidth, (size.height * 0.88) / contentHeight)));
  const effectiveScale = autoFit * userZoom;
  const contentCentreX = (bounds.minX + bounds.maxX) / 2;
  const contentCentreY = (bounds.minY + bounds.maxY) / 2;
  const centreX = selected ? 0 : contentCentreX;
  const centreY = selected ? 0 : contentCentreY;
  const tx = size.width / 2 - centreX * effectiveScale + pan.x;
  const ty = size.height / 2 - centreY * effectiveScale + pan.y;
  const heroScale = Math.min(1.4, Math.max(0.85, 1 / effectiveScale));

  const edges = useMemo(() => {
    if (!selected) return [];
    return rows
      .filter((row) => row.id !== selected.id)
      .map((row) => ({ to: nodeById.get(row.id), score: similarity(selected, row, mode) }))
      .filter((edge): edge is { to: NodePos; score: number } => !!edge.to && edge.score >= threshold && edge.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }, [mode, nodeById, rows, selected, threshold]);
  const neighbourIds = useMemo(() => new Set(edges.map((edge) => edge.to.id)), [edges]);
  const heroClusterEdges = useMemo(() => {
    const best = new Map<number, number>();
    for (const edge of edges) best.set(edge.to.ci, Math.max(best.get(edge.to.ci) ?? 0, edge.score));
    return [...best].map(([ci, score]) => {
      const box = boxes.find((candidate) => candidate.ci === ci);
      return box ? { box, score } : null;
    }).filter((item): item is { box: ClusterBox; score: number } => !!item);
  }, [boxes, edges]);

  const clusterLinks = useMemo(() =>
    boxes.slice(0, -1).map((box, index) => {
      const next = boxes[index + 1];
      return next
        ? { x1: box.x + box.width / 2, y1: box.y + box.height / 2, x2: next.x + next.width / 2, y2: next.y + next.height / 2 }
        : null;
    }).filter((link): link is { x1: number; y1: number; x2: number; y2: number } => !!link),
  [boxes]);

  const resetFit = useCallback(() => {
    setUserZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(resetFit, [clusters, mode, selectedId, size.width, size.height, resetFit]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      setUserZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value * Math.exp(-delta * 0.0015))));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-[var(--map-surface)] shadow-card">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:26px_26px] opacity-40" />
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-background/90 p-0.5 backdrop-blur">
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom out" onClick={() => setUserZoom((value) => Math.max(MIN_ZOOM, value / 1.2))}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(userZoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zoom in" onClick={() => setUserZoom((value) => Math.min(MAX_ZOOM, value * 1.2))}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Reset map" onClick={resetFit}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative h-[68vh] max-h-[820px] min-h-[560px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
          moved.current = false;
        }}
        onPointerMove={(event) => {
          const origin = drag.current;
          if (!origin) return;
          const dx = event.clientX - origin.x;
          const dy = event.clientY - origin.y;
          if (!moved.current && Math.hypot(dx, dy) < 4) return;
          moved.current = true;
          setPan({ x: origin.px + dx, y: origin.py + dy });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} aria-label="Startup similarity map">
          <defs>
            <filter id="selected-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="var(--map-accent)" floodOpacity="0.35" />
            </filter>
            <filter id="hero-shadow" x="-30%" y="-50%" width="160%" height="200%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="var(--foreground)" floodOpacity="0.16" />
            </filter>
          </defs>
          <g
            transform={`translate(${tx} ${ty}) scale(${effectiveScale})`}
            className="transition-transform duration-300 ease-out"
          >
            {clusterLinks.map((link, index) => (
              <line key={index} {...link} stroke="var(--muted-foreground)" strokeWidth={1 / effectiveScale} strokeOpacity={0.2} strokeDasharray="2 5" />
            ))}

            {boxes.map((box) => {
              const active = anchor?.ci === box.ci;
              return (
                <g key={box.key}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    rx={20}
                    fill={`color-mix(in oklab, ${clusterColor(box.ci)} ${active ? 11 : 7}%, var(--card))`}
                    stroke={`color-mix(in oklab, ${clusterColor(box.ci)} 40%, transparent)`}
                    strokeWidth={1 / effectiveScale}
                  />
                  <circle cx={box.x + 20} cy={box.y + 19} r={4} fill={clusterColor(box.ci)} />
                  <text x={box.x + 30} y={box.y + 18} fontSize={15} fontWeight={600} fill="var(--foreground)">{box.name}</text>
                  <text x={box.x + 30} y={box.y + 31} fontSize={11} fill="var(--muted-foreground)">{box.count} startups</text>
                </g>
              );
            })}

            {selected && heroClusterEdges.map(({ box, score }) => {
              const style = edgeStyle(score, threshold);
              return (
                <line
                  key={box.key}
                  x1={0}
                  y1={0}
                  x2={box.x + box.width / 2}
                  y2={box.y + box.height / 2}
                  stroke={style.width === 2 ? "var(--map-accent)" : "var(--muted-foreground)"}
                  strokeWidth={style.width / effectiveScale}
                  strokeOpacity={style.opacity}
                  strokeDasharray={style.dash}
                />
              );
            })}

            {anchor && (
              <line x1={anchor.x} y1={anchor.y} x2={0} y2={0} stroke="var(--map-accent)" strokeWidth={2 / effectiveScale} strokeOpacity={1} />
            )}

            {anchor && edges.filter((edge) => edge.to.ci === anchor.ci).map((edge) => {
              const style = edgeStyle(edge.score, threshold);
              return (
                <line
                  key={edge.to.id}
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={edge.to.x}
                  y2={edge.to.y}
                  stroke={style.width === 2 ? "var(--map-accent)" : "var(--muted-foreground)"}
                  strokeWidth={style.width / effectiveScale}
                  strokeOpacity={style.opacity}
                  strokeDasharray={style.dash}
                />
              );
            })}

            {nodes.map((node) => {
              const isSelected = node.id === selectedId;
              const isNeighbour = neighbourIds.has(node.id);
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  opacity={anchor && !isSelected && !isNeighbour ? 0.52 : 1}
                  onPointerUp={(event) => { event.stopPropagation(); const wasDrag = moved.current; drag.current = null; if (!wasDrag) onSelect(node.id); }}
                >
                  <title>{node.startup.startup_name}</title>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={NODE_SIZE / 2}
                    fill="var(--card)"
                    stroke={isSelected ? "var(--map-accent)" : `color-mix(in oklab, ${clusterColor(node.ci)} 45%, var(--border))`}
                    strokeWidth={(isSelected ? 2.5 : 1) / effectiveScale}
                    filter={isSelected ? "url(#selected-glow)" : undefined}
                  />
                  {node.startup.logo_signed_url ? (
                    <>
                      <clipPath id={`node-clip-${node.id}`}><circle cx={node.x} cy={node.y} r={19} /></clipPath>
                      <image href={node.startup.logo_signed_url} x={node.x - 19} y={node.y - 19} width={38} height={38} clipPath={`url(#node-clip-${node.id})`} preserveAspectRatio="xMidYMid contain" />
                    </>
                  ) : (
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--muted-foreground)">{monogram(node.startup.startup_name)}</text>
                  )}
                  <text x={node.x} y={node.y + 36} textAnchor="middle" fontSize={11} fontWeight={isSelected ? 600 : 500} fill={isSelected ? "var(--map-accent)" : "var(--foreground)"}>{shortName(node.startup.startup_name)}</text>
                </g>
              );
            })}

            {boxes.map((box) => {
              if (!box.overflow) return null;
              const itemCount = box.displayMembers.length + 1;
              const columns = Math.max(1, Math.ceil(Math.sqrt(itemCount)));
              const index = itemCount - 1;
              const contentWidth = columns * NODE_SIZE + (columns - 1) * NODE_GAP;
              const startX = box.x + (box.width - contentWidth) / 2 + NODE_SIZE / 2;
              const startY = box.y + CLUSTER_PADDING + CLUSTER_HEADER + NODE_SIZE / 2;
              const x = startX + (index % columns) * (NODE_SIZE + NODE_GAP);
              const y = startY + Math.floor(index / columns) * (NODE_CELL_HEIGHT + NODE_GAP);
              return (
                <g key={`${box.key}-overflow`}>
                  <circle cx={x} cy={y} r={NODE_SIZE / 2} fill={`color-mix(in oklab, ${clusterColor(box.ci)} 18%, var(--card))`} stroke={`color-mix(in oklab, ${clusterColor(box.ci)} 45%, var(--border))`} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">+{box.overflow}</text>
                </g>
              );
            })}

            {selected && (
              <g transform={`translate(0 0) scale(${heroScale})`} className="transition-all duration-300 ease-out">
                <rect x={-HERO_WIDTH / 2} y={-HERO_HEIGHT / 2} width={HERO_WIDTH} height={HERO_HEIGHT} rx={16} fill="var(--card)" stroke="var(--map-accent)" strokeWidth={2 / heroScale} filter="url(#hero-shadow)" />
                <rect x={-HERO_WIDTH / 2 + 16} y={-28} width={56} height={56} rx={12} fill="var(--muted)" stroke="var(--border)" />
                {selected.logo_signed_url ? (
                  <image href={selected.logo_signed_url} x={-HERO_WIDTH / 2 + 18} y={-26} width={52} height={52} preserveAspectRatio="xMidYMid contain" />
                ) : (
                  <text x={-HERO_WIDTH / 2 + 44} y={5} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--map-accent)">{monogram(selected.startup_name)}</text>
                )}
                <text x={-HERO_WIDTH / 2 + 84} y={-8} fontSize={17} fontWeight={600} fill="var(--foreground)">{selected.startup_name.length > 20 ? `${selected.startup_name.slice(0, 19)}…` : selected.startup_name}</text>
                <text x={-HERO_WIDTH / 2 + 84} y={13} fontSize={12} fill="var(--muted-foreground)">{[selected.industry?.[0], selected.region, selected.investment_stage].filter(Boolean).join(" · ") || "Startup"}</text>
                <rect x={HERO_WIDTH / 2 - 70} y={-35} width={56} height={20} rx={10} fill="color-mix(in oklab, var(--map-accent) 12%, var(--card))" />
                <text x={HERO_WIDTH / 2 - 42} y={-21} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--map-accent)">{edges.length ? `${Math.round(edges[0]?.score ? (edges[0].score * 100) : 100)}% Match` : "Selected"}</text>
              </g>
            )}
          </g>
        </svg>
        {clusters.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No startups match the current filters.</p>}
      </div>
    </div>
  );
}