import { useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  items: string[];
  maxRows: number;
  itemClassName?: string;
  overflowClassName?: string;
  gapPx?: number;
  className?: string;
  /** Optional leading label (e.g. an icon + text) rendered inline before items. */
  leading?: React.ReactNode;
}

/**
 * Renders `items` on up to `maxRows` rows, aligned to the left, and appends a
 * "+N" indicator with a tooltip listing hidden items when they don't all fit.
 */
export function OverflowRow({
  items,
  maxRows,
  itemClassName,
  overflowClassName,
  gapPx = 4,
  className,
  leading,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const hasLeading = Boolean(leading);
      const children = Array.from(measure.children) as HTMLElement[];
      const leadingNode = hasLeading ? children[0] : null;
      const itemStart = hasLeading ? 1 : 0;
      // Items are children[itemStart .. itemStart + items.length - 1]; last child is the "+N" chip.
      const itemNodes = children.slice(itemStart, itemStart + items.length);
      const overflowNode = children[children.length - 1];

      if (itemNodes.length === 0) {
        setVisibleCount(0);
        return;
      }

      const rowHeight = itemNodes[0].offsetHeight;
      const maxHeight = rowHeight * maxRows + gapPx * (maxRows - 1) + 1;

      // First: does everything fit without overflow chip?
      const fitsAll = measure.scrollHeight <= maxHeight;
      if (fitsAll) {
        setVisibleCount(items.length);
        return;
      }

      // Binary/linear search: find largest k such that leading + first k items + "+N" fits.
      const overflowWidth =
        (overflowNode?.offsetWidth ?? 0) +
        (leadingNode?.offsetWidth ?? 0) +
        (hasLeading ? gapPx : 0);
      let count = 0;
      for (let k = items.length - 1; k >= 0; k--) {
        // Temporarily hide items beyond k.
        for (let i = 0; i < itemNodes.length; i++) {
          itemNodes[i].style.display = i < k ? "" : "none";
        }
        overflowNode.style.display = "";
        // Force reflow read
        const h = measure.scrollHeight;
        if (h <= maxHeight && overflowWidth <= containerWidth) {
          count = k;
          break;
        }
      }
      // Reset display
      for (const n of itemNodes) n.style.display = "";
      overflowNode.style.display = "";
      setVisibleCount(count);
    };

    setVisibleCount(items.length);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items, maxRows, gapPx]);

  const hidden = items.slice(visibleCount);
  const shown = items.slice(0, visibleCount);

  const chipClass = cn(
    "inline-flex items-center max-w-[10rem] truncate rounded-full border px-1.5 py-0 text-[10px] font-medium",
    itemClassName,
  );

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      {/* Hidden measurement layer: renders leading + all items + overflow chip. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-0 flex flex-wrap content-start items-start justify-start"
        style={{ gap: gapPx }}
      >
        {leading}
        {items.map((t) => (
          <span key={`m-${t}`} className={chipClass}>
            {t}
          </span>
        ))}
        <span className={cn("inline-block text-[10px]", overflowClassName)}>
          +{items.length}
        </span>
      </div>

      {/* Visible layer */}
      <div
        className="flex w-full flex-wrap content-start items-start justify-start"
        style={{ gap: gapPx }}
      >
        {leading}
        <TooltipProvider delayDuration={200}>
          {shown.map((t) => (
            <Tooltip key={t}>
              <TooltipTrigger asChild>
                <span className={chipClass}>{t}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{t}</TooltipContent>
            </Tooltip>
          ))}
          {hidden.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "cursor-default text-[10px] text-muted-foreground",
                    overflowClassName,
                  )}
                >
                  +{hidden.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs break-words">
                {hidden.join(", ")}
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
