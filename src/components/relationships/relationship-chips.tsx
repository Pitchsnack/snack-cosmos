import { useMemo, type MouseEvent } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RelationshipChipItem {
  id: string;
  name: string;
}

interface Props {
  icon: React.ReactNode;
  label: string;
  items: RelationshipChipItem[];
  /** Max chips to render inline before collapsing into +N. */
  maxVisible?: number;
  /** Popover heading, e.g. "All Investors" / "All Startups". */
  popoverTitle: string;
  className?: string;
}

/** Sort by name length asc, then alphabetical (case-insensitive). Display only. */
function sortForDisplay(items: RelationshipChipItem[]): RelationshipChipItem[] {
  return [...items].sort((a, b) => {
    const la = a.name.length;
    const lb = b.name.length;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

const CHIP_BASE =
  "inline-block max-w-[10rem] truncate rounded-full border border-border/70 bg-background px-1.5 py-0 text-[10px] font-medium text-foreground/80";

/** Stop card-level Link/button navigation when interacting with a chip control. */
function stop(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function RelationshipChips({
  icon,
  label,
  items,
  maxVisible = 3,
  popoverTitle,
  className,
}: Props) {
  const sorted = useMemo(() => sortForDisplay(items), [items]);
  if (sorted.length === 0) return null;

  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.slice(maxVisible);

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-1.5 overflow-hidden text-[10px] text-muted-foreground",
        className,
      )}
    >
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {visible.map((it) => (
          <Tooltip key={it.id} delayDuration={200}>
            <TooltipTrigger asChild>
              <span className={CHIP_BASE}>{it.name}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs break-words">
              {it.name}
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={stop}
                onMouseDown={stop}
                className="shrink-0 rounded-full border border-border/70 bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                aria-label={`Show ${overflow.length} more`}
              >
                +{overflow.length}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={6}
              className="w-56 rounded-lg border border-border bg-popover p-2 shadow-lg"
              onClick={stop}
              onMouseDown={stop}
            >
              <div className="mb-1 px-1 text-[11px] font-semibold text-foreground">
                {popoverTitle}
              </div>
              <div className="max-h-56 overflow-y-auto pr-1">
                <ul className="flex flex-col gap-1">
                  {sorted.map((it) => (
                    <li
                      key={it.id}
                      className="truncate rounded px-1.5 py-1 text-[11px] text-foreground/90 hover:bg-muted"
                      title={it.name}
                    >
                      {it.name}
                    </li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
