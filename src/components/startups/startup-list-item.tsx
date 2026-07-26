import { useState, type CSSProperties } from "react";
import { MapPin, Users, Bookmark, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StartupListItem as StartupListItemDTO } from "@/lib/startups.functions";
import { RelationshipChips } from "@/components/relationships/relationship-chips";
import { OverflowRow } from "@/components/startups/overflow-row";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { useFavoriteStartups } from "@/hooks/use-favorites";



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

export function StartupListItem({
  s,
  selected,
  onSelect,
}: {
  s: StartupListItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { isFavorite, toggle } = useFavoriteStartups();
  const bookmarked = isFavorite(s.id);
  const [expanded, setExpanded] = useState(false);


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
        "group relative flex w-full flex-col items-start overflow-hidden rounded-lg border bg-card p-3 text-left shadow-card transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
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
      <span
        className="absolute right-3 top-3 z-10 rounded-full p-1 hover:bg-muted/50"
        onClick={(e) => {
          e.stopPropagation();
          toggle(s.id);
        }}
      >

        <Bookmark
          className={cn(
            "h-4 w-4 transition-colors",
            bookmarked ? "fill-accent text-accent" : "text-muted-foreground",
          )}
        />
      </span>

      <div className="flex w-full items-start gap-3 pr-8">
        <div className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {monogram(s.startup_name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-left text-sm font-semibold leading-tight group-hover:text-accent">
              {s.startup_name}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <PreviewNeedsReassignmentBadge name={s.startup_name} domain="startup" size="xs" />
              {s.investment_stage && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {s.investment_stage}
                </Badge>
              )}
            </div>
          </div>
          {s.company_type && (
            <div className="mt-0.5 text-left text-[11px] text-muted-foreground">{s.company_type}</div>
          )}
          {s.headquarters && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-left text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {s.headquarters}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-2 w-full flex-1 text-left",
          expanded ? "overflow-visible" : "min-h-0 overflow-hidden",
        )}
      >
        {s.short_description && (
          <p
            className={cn(
              "w-full text-left text-[11px] text-foreground/80",
              expanded ? "" : "line-clamp-2",
            )}
          >
            {s.short_description}
          </p>
        )}
        {s.product_tags?.length ? (
          <div
            className={cn(
              "mt-1.5 w-full text-left",
              expanded ? "" : "max-h-[2.8rem] overflow-hidden",
            )}
          >
            <ChipRow tags={s.product_tags} tone="primary" showAll={expanded} />
          </div>
        ) : null}
        {s.market_tags?.length ? (
          <div className="mt-1.5 flex w-full items-start gap-1.5 overflow-hidden text-left">
            <span className="mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
              <ShoppingCart className="h-3 w-3 shrink-0" />
            </span>
            {expanded ? (
              <div className="flex w-full flex-wrap items-start gap-1">
                <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
                  Market:
                </span>
                {s.market_tags.map((t) => (
                  <span
                    key={t}
                    className="max-w-[10rem] truncate rounded-full border border-transparent bg-muted/50 px-1.5 py-0 text-[9px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <OverflowRow
                items={s.market_tags}
                maxRows={1}
                itemClassName="bg-muted/50 text-muted-foreground border-transparent"
                leading={
                  <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
                    <span>Market:</span>
                  </span>
                }
              />
            )}
          </div>
        ) : null}
        {s.related_investors?.length ? (
          <div
            className={cn(
              "mt-1.5 w-full text-left",
              expanded ? "" : "max-h-[1.5rem] overflow-hidden",
            )}
          >
            {expanded ? (
              <div className="flex w-full flex-wrap items-start gap-1">
                <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Investors:</span>
                </span>
                {s.related_investors.map((inv) => (
                  <span
                    key={inv.id}
                    className="inline-block rounded-full border border-border/70 bg-background px-1.5 py-0 text-[10px] font-medium text-foreground/80"
                  >
                    {inv.name}
                  </span>
                ))}
              </div>
            ) : (
              <RelationshipChips
                className="w-full justify-start"
                icon={<Users className="h-3 w-3" />}
                label="Investors:"
                items={s.related_investors}
                popoverTitle="All Investors"
                maxVisible={3}
              />
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex w-full justify-end pt-1">
        <span
          className="cursor-pointer text-xs font-medium text-accent group-hover:underline"
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

function ChipRow({ tags, tone, showAll = false }: { tags: string[]; tone: "primary" | "muted"; showAll?: boolean }) {
  const shown = showAll ? tags : tags.slice(0, 5);
  const overflow = showAll ? 0 : tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="flex flex-wrap justify-start gap-1">
      {shown.map((t) => (
        <span key={t} className={`max-w-[10rem] truncate rounded-full border px-1.5 py-0 text-[9px] font-medium ${base}`}>
          {t}
        </span>
      ))}
      {overflow > 0 && <span className="text-[9px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}

