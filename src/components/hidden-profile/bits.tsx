import type { ReactNode } from "react";
import { Link2, Lock, ArrowLeftRight, Waves, ImageIcon } from "lucide-react";
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

export function SectorArt({ art, className, children }: { art?: string | null; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-gradient-to-br from-muted to-secondary text-muted-foreground", className)}>
      <div className="flex flex-col items-center gap-1 text-[11px]">
        <ImageIcon className="h-5 w-5 opacity-60" />
        {art ?? "Sector image"}
      </div>
      {children}
    </div>
  );
}
