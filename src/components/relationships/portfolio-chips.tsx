import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  ChevronDown,
  Cpu,
  Globe2,
  HeartPulse,
  Landmark,
  Leaf,
  Megaphone,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const OTHER_GROUP = "Other Industries";

export interface ChipItem {
  id: string;
  name: string;
  logoUrl?: string | null;
}

function firstLetter(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** Shared chip geometry — used by portfolio pages and entity detail panels. */
export const CHIP_CLASS =
  "flex h-[34px] max-w-[180px] shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 transition-colors hover:border-foreground/25 hover:bg-muted/50";
export const CHIP_LOGO_CLASS =
  "flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-muted text-[10px] font-semibold text-muted-foreground";
export const CHIP_NAME_CLASS = "truncate text-[13px] font-medium text-foreground";

/** Chip body (logo + name) so every surface renders identical geometry. */
export function ChipBody({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <>
      <span className={CHIP_LOGO_CLASS}>
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          firstLetter(name)
        )}
      </span>
      <span className={CHIP_NAME_CLASS}>{name}</span>
    </>
  );
}

/** Single-line 34px chip: 22px logo + name. Nothing else. */
export function StartupChip({
  item,
  onSelect,
}: {
  item: ChipItem;
  /** When provided the chip opens an in-page panel instead of navigating. */
  onSelect?: (id: string) => void;
}) {
  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item.id)} className={cn(CHIP_CLASS, "text-left")}>
        <ChipBody name={item.name} logoUrl={item.logoUrl} />
      </button>
    );
  }
  return (
    <Link to="/startups/$id" params={{ id: item.id }} className={CHIP_CLASS}>
      <ChipBody name={item.name} logoUrl={item.logoUrl} />
    </Link>
  );
}

function MoreChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[34px] shrink-0 items-center rounded-lg border border-border bg-muted px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70"
    >
      +{count} more
    </button>
  );
}

/**
 * Lays chips on a single line; measures available width and collapses the
 * overflow into a "+N more" chip. When expanded, chips wrap freely.
 */
export function ChipRow({
  items,
  expanded,
  onExpand,
  onSelect,
  className,
}: {
  items: ChipItem[];
  expanded: boolean;
  onExpand: () => void;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(items.length);

  useLayoutEffect(() => {
    if (expanded) return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      const children = Array.from(el.children) as HTMLElement[];
      const GAP = 8;
      const MORE = 92;
      let used = 0;
      let count = 0;
      for (const child of children) {
        const w = child.getBoundingClientRect().width;
        const next = used + (count ? GAP : 0) + w;
        if (next > width) break;
        used = next;
        count += 1;
      }
      if (count < children.length) {
        while (count > 1 && used + GAP + MORE > width) {
          const w = (children[count - 1] as HTMLElement).getBoundingClientRect().width;
          used -= w + GAP;
          count -= 1;
        }
      }
      setVisible(Math.max(1, count));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, expanded]);

  if (expanded) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {items.map((i) => (
          <StartupChip key={i.id} item={i} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const hidden = items.length - visible;
  return (
    <div className={cn("relative", className)}>
      {/* measuring layer: full list, no wrap, invisible */}
      <div
        ref={containerRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-[34px] gap-2 overflow-hidden"
      >
        {items.map((i) => (
          <StartupChip key={i.id} item={i} />
        ))}
      </div>
      <div className="flex h-[34px] gap-2 overflow-hidden">
        {items.slice(0, visible).map((i) => (
          <StartupChip key={i.id} item={i} onSelect={onSelect} />
        ))}
        {hidden > 0 && <MoreChip count={hidden} onClick={onExpand} />}
      </div>
    </div>
  );
}

/** hue, tile background, glyph colour per category family. */
const TINTS = [
  { bg: "bg-emerald-500/10", fg: "text-emerald-600" },
  { bg: "bg-blue-500/10", fg: "text-blue-600" },
  { bg: "bg-purple-500/10", fg: "text-purple-600" },
  { bg: "bg-rose-500/10", fg: "text-rose-600" },
  { bg: "bg-amber-500/10", fg: "text-amber-600" },
  { bg: "bg-cyan-500/10", fg: "text-cyan-600" },
  { bg: "bg-indigo-500/10", fg: "text-indigo-600" },
  { bg: "bg-teal-500/10", fg: "text-teal-600" },
];

const NEUTRAL_TINT = { bg: "bg-muted", fg: "text-muted-foreground" };

const GLYPHS: { match: RegExp; icon: typeof Landmark; tint: number }[] = [
  { match: /fin|bank|pay|insur/i, icon: Landmark, tint: 0 },
  { match: /climate|green|energy|agri|sustain/i, icon: Leaf, tint: 0 },
  { match: /mar(ket)?tech|market|ad|media/i, icon: Megaphone, tint: 3 },
  { match: /health|med|bio|care/i, icon: HeartPulse, tint: 1 },
  { match: /commerce|retail|shop|consumer/i, icon: ShoppingBag, tint: 4 },
  { match: /enterprise|saas|software|deep|ai|data/i, icon: Cpu, tint: 2 },
  { match: /country|region|global/i, icon: Globe2, tint: 5 },
];

function hashIndex(label: string, mod: number) {
  let h = 0;
  for (let i = 0; i < label.length; i += 1) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** 40px tinted icon tile for a group header; hue derives from the category. */
export function GroupIconTile({ label }: { label: string }) {
  if (label === OTHER_GROUP) {
    return (
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
          NEUTRAL_TINT.bg,
          NEUTRAL_TINT.fg,
        )}
      >
        <Boxes className="h-5 w-5" strokeWidth={1.75} />
      </span>
    );
  }
  const match = GLYPHS.find((g) => g.match.test(label));
  const Icon = match?.icon ?? Building2;
  const tint = TINTS[match ? match.tint : hashIndex(label, TINTS.length)]!;
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
        tint.bg,
        tint.fg,
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

export function GroupCardHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <GroupIconTile label={title} />
        <span className="truncate text-[15px] font-semibold">
          {title} <span className="text-muted-foreground">({count})</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-link hover:underline"
      >
        {expanded ? "Collapse" : `View all ${count}`}
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
    </div>
  );
}
