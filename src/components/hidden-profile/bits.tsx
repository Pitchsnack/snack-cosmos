import type { ReactNode } from "react";
import { Link2, Lock, ArrowLeftRight, Waves, Building2, Factory, ShoppingBag, Truck, HeartPulse, Utensils, Monitor, Clapperboard, BriefcaseBusiness } from "lucide-react";
import { cn } from "@/lib/utils";
import { findTermsIn, STATUS_LABEL, type HiddenStatus } from "@/lib/hidden-profile";

const TONE: Record<HiddenStatus, string> = {
  live: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  live_edited: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  draft: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  none: "border-border bg-muted text-muted-foreground",
  na: "border-border bg-muted text-muted-foreground",
};

export function HiddenStatusChip({ status, codeName, className }: { status: HiddenStatus; codeName?: string | null; className?: string }) {
  const label =
    status === "none" ? "None yet" : status === "na" ? "Not for startups" : `${STATUS_LABEL[status]}${codeName ? ` · ${codeName}` : ""}`;
  return (
    <span className={cn("inline-flex h-5 max-w-full items-center truncate rounded-full border px-2 text-[11px] font-medium", TONE[status], className)}>
      {label}
    </span>
  );
}

export type MarkerKind = "shared" | "range" | "own" | "nda";
export const MARKERS: Record<MarkerKind, { label: string; icon: typeof Link2; tone: string }> = {
  shared: { label: "Shared", icon: Link2, tone: "text-emerald-600 dark:text-emerald-400" },
  range: { label: "Range", icon: Waves, tone: "text-sky-600 dark:text-sky-400" },
  own: { label: "Own version", icon: ArrowLeftRight, tone: "text-amber-600 dark:text-amber-400" },
  nda: { label: "Hidden until NDA", icon: Lock, tone: "text-muted-foreground" },
};

export function Marker({ kind, labelled, show = true }: { kind: MarkerKind; labelled?: boolean; show?: boolean }) {
  if (!show) return null;
  const m = MARKERS[kind];
  const Icon = m.icon;
  return (
    <span title={m.label} className={cn("inline-flex shrink-0 items-center gap-1 align-middle text-[11px]", m.tone)}>
      <Icon className="h-3 w-3" />
      {labelled && m.label}
    </span>
  );
}

export function MarkerLegend({ show, onToggle }: { show: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="font-medium">Fields:</span>
      {(Object.keys(MARKERS) as MarkerKind[]).map((k) => (
        <Marker key={k} kind={k} labelled />
      ))}
      <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" checked={show} onChange={(e) => onToggle(e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--accent))]" />
        Show markers
      </label>
    </div>
  );
}

/** Renders text with identity-check hits marked red. */
export function Flagged({ text, terms }: { text: string; terms: { term: string; reason: string }[] }) {
  if (!text) return null;
  const hits = findTermsIn(text, terms);
  if (!hits.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let i = 0;
  hits.forEach((h, k) => {
    if (h.start > i) out.push(text.slice(i, h.start));
    out.push(
      <mark key={k} title={h.reason} className="rounded bg-destructive/15 px-0.5 text-destructive">
        {text.slice(h.start, h.end)}
      </mark>,
    );
    i = h.end;
  });
  out.push(text.slice(i));
  return <>{out}</>;
}

/**
 * Listing cover. Follows the shared cover rule (picked image → sector's first
 * image → drawn default). `plain` always draws the default cover.
 */
export function SectorArt({ art, sector, imageId, plain, className, children, tile }: { art?: string | null; sector?: string | null; imageId?: string | null; plain?: boolean; className?: string; children?: ReactNode; tile?: ReactNode }) {
  const { data: images } = useSectorImages();
  const img = plain ? null : resolveCover(images, sector ?? art, imageId);
  if (img?.url) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        {tile && <div className="absolute inset-0 grid place-items-center"><div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">{tile}</div></div>}
        {children}
      </div>
    );
  }
  return <DrawnCover art={art ?? sector} className={className} tile={tile}>{children}</DrawnCover>;
}

function DrawnCover({ art, className, children, tile }: { art?: string | null; className?: string; children?: ReactNode; tile?: ReactNode }) {
  const name = art || "Business";
  const lower = name.toLowerCase();
  const Icon = /food|beverage|restaurant|agri/.test(lower) ? Utensils
    : /manufactur|industrial|material|energy/.test(lower) ? Factory
    : /tech|digital|telecom/.test(lower) ? Monitor
    : /retail|consumer|commerce/.test(lower) ? ShoppingBag
    : /logistic|transport/.test(lower) ? Truck
    : /health|medical|hospital/.test(lower) ? HeartPulse
    : /media|entertainment/.test(lower) ? Clapperboard
    : /service|finance|property/.test(lower) ? BriefcaseBusiness : Building2;
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-secondary text-secondary-foreground", className)}>
      <div aria-hidden="true" className="absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(135deg,transparent 0px,transparent 24px,var(--border) 25px,transparent 26px)" }} />
      <div className="relative flex flex-col items-center gap-1.5 text-center">
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">{tile ?? <Icon className="h-6 w-6 text-profile" strokeWidth={1.5} />}</div>
        <span className="max-w-[160px] truncate text-[11px] font-semibold">{name}</span>
      </div>
      {children}
    </div>
  );
}
