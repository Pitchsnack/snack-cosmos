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

/** Single-line 36px chip: 24px logo + name. Nothing else. */
export function StartupChip({ item }: { item: ChipItem }) {
  return (
    <Link
      to="/startups/$id"
      params={{ id: item.id }}
      className="flex h-9 max-w-[160px] shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 transition-colors hover:border-foreground/25 hover:bg-muted/50"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
        {item.logoUrl ? (
          <img src={item.logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          firstLetter(item.name)
        )}
      </span>
      <span className="truncate text-[13px] font-medium text-foreground">{item.name}</span>
    </Link>
  );
}

function MoreChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 shrink-0 items-center rounded-lg border border-border bg-muted px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70"
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
}: {
  items: ChipItem[];
  expanded: boolean;
  onExpand: () => void;
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
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <StartupChip key={i.id} item={i} />
        ))}
      </div>
    );
  }

  const hidden = items.length - visible;
  return (
    <div className="relative">
      {/* measuring layer: full list, no wrap, invisible */}
      <div
        ref={containerRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-9 gap-2 overflow-hidden"
      >
        {items.map((i) => (
          <StartupChip key={i.id} item={i} />
        ))}
      </div>
      <div className="flex h-9 gap-2 overflow-hidden">
        {items.slice(0, visible).map((i) => (
          <StartupChip key={i.id} item={i} />
        ))}
        {hidden > 0 && <MoreChip count={hidden} onClick={onExpand} />}
      </div>
    </div>
  );
}

const GLYPHS: { match: RegExp; icon: typeof Landmark }[] = [
  { match: /fin|bank|pay|insur/i, icon: Landmark },
  { match: /climate|green|energy|agri|sustain/i, icon: Leaf },
  { match: /mar(ket)?tech|market|ad|media/i, icon: Megaphone },
  { match: /health|med|bio|care/i, icon: HeartPulse },
  { match: /commerce|retail|shop|consumer/i, icon: ShoppingBag },
  { match: /enterprise|saas|software|deep|ai|data/i, icon: Cpu },
  { match: /country|region|global/i, icon: Globe2 },
];

/** 40px tinted icon tile for a group header. */
export function GroupIconTile({ label }: { label: string }) {
  const Icon =
    label === OTHER_GROUP
      ? Boxes
      : (GLYPHS.find((g) => g.match.test(label))?.icon ?? Building2);
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-link/10 text-link">
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
