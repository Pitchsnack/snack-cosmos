import { useState, type CSSProperties } from "react";
import { MapPin, Building2, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InvestorListItem as InvestorListItemDTO } from "@/lib/investors.functions";
import { RelationshipChips } from "@/components/relationships/relationship-chips";
import { OverflowRow } from "@/components/startups/overflow-row";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const HOVER_CARD_STYLE: CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow:
    "0 8px 20px rgba(15, 23, 42, 0.10), 0 0 0 1px color-mix(in hsl, var(--accent), transparent 65%)",
};

const PRESSED_CARD_STYLE: CSSProperties = {
  borderColor: "color-mix(in hsl, var(--accent), black 18%)",
  boxShadow: "0 4px 12px color-mix(in hsl, var(--accent), black 25%)",
};

export function InvestorListItem({
  i,
  selected,
  onSelect,
}: {
  i: InvestorListItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ticket =
    i.ticket_size || [i.min_ticket_size, i.max_ticket_size].filter(Boolean).join(" – ") || null;

  const cardStyle: CSSProperties | undefined = isPressed
    ? PRESSED_CARD_STYLE
    : isHovered
      ? HOVER_CARD_STYLE
      : undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col items-start overflow-hidden rounded-lg border bg-card p-2.5 text-left shadow-card transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        expanded ? "h-auto" : "h-[220px]",
        selected ? "border-accent ring-1 ring-accent/30" : "border-border",
      )}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
    >
      <FavoriteToggle id={i.id} entity="investors" size="md" className="absolute right-3 top-3" />

      <div className="flex w-full items-start gap-3 pr-8">
        <div className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {i.logo_signed_url ? (
            <img src={i.logo_signed_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {monogram(i.investor_name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-left text-sm font-semibold leading-tight group-hover:text-accent">
              {i.investor_name}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <PreviewNeedsReassignmentBadge name={i.investor_name} domain="investor" size="xs" />
              {i.investor_type && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {i.investor_type}
                </Badge>
              )}
            </div>
          </div>
          {i.country && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-left text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {i.country}
            </div>
          )}
          {(i.aum || ticket) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-left text-[10px] text-muted-foreground">
              {i.aum && (
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-2.5 w-2.5" /> AUM {i.aum}
                </span>
              )}
              {ticket && <span>· Ticket {ticket}</span>}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-1.5 w-full flex-1 text-left",
          expanded ? "overflow-visible" : "min-h-0 overflow-hidden",
        )}
      >
        {i.short_description && (
          <p
            className={cn(
              "w-full text-left text-[11px] leading-snug text-foreground/80",
              expanded ? "" : "line-clamp-2",
            )}
          >
            {i.short_description}
          </p>
        )}
        {i.preferred_stages?.length ? (
          <div className="mt-1 w-full text-left">
            <OverflowRow
              items={i.preferred_stages}
              maxRows={expanded ? 4 : 1}
              itemClassName="bg-primary/10 text-primary border-primary/30"
            />
          </div>
        ) : null}
        {i.preferred_industries?.length ? (
          <div className="mt-1 w-full text-left">
            <OverflowRow
              items={i.preferred_industries}
              maxRows={expanded ? 4 : 1}
              itemClassName="bg-muted/50 text-muted-foreground border-transparent"
              leading={
                <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
                  <span>Focus:</span>
                </span>
              }
            />
          </div>
        ) : null}
        {i.related_startups?.length ? (
          <div
            className={cn("mt-1 w-full text-left", expanded ? "" : "max-h-[1.4rem] overflow-hidden")}
          >
            <RelationshipChips
              className="w-full justify-start"
              icon={<Building2 className="h-3 w-3" />}
              label="Startups:"
              items={i.related_startups}
              popoverTitle="All Startups"
              maxVisible={3}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex w-full justify-end pt-0.5">
        <span
          className="cursor-pointer text-xs font-medium text-blue-900 group-hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Show less" : "View details"}
        </span>
      </div>
    </button>
  );
}
