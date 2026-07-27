import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MapPin, Factory, ShoppingCart, Users, Bookmark } from "lucide-react";
import anchorIcon from "@/assets/anchor.svg";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StartupListItem } from "@/lib/startups.functions";
import { OverflowRow } from "@/components/startups/overflow-row";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";


function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const CARD_CLASS =
  "group relative flex h-[440px] w-full cursor-pointer flex-col rounded-xl border border-border bg-card text-left shadow-card transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

const COMPACT_CARD_CLASS =
  "group relative flex h-[380px] w-full cursor-pointer flex-col rounded-xl border border-border bg-card text-left shadow-card transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

const HOVER_CARD_STYLE: CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow:
    "0 8px 20px rgba(15, 23, 42, 0.10), 0 0 0 1px color-mix(in hsl, var(--accent), transparent 65%)",
};

const PRESSED_CARD_STYLE: CSSProperties = {
  borderColor: "color-mix(in hsl, var(--accent), black 18%)",
  boxShadow: "0 4px 12px color-mix(in hsl, var(--accent), black 25%)",
};

/** Wraps a truncated element with a tooltip showing full text. */
function Truncate({
  text,
  children,
  className,
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function StartupCard({ s, onClick }: { s: StartupListItem; onClick?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const { isFavorite, toggle } = useFavoriteStartups();
  const bookmarked = isFavorite(s.id);

  const [isPressed, setIsPressed] = useState(false);
  const BROAD = ["Enterprise", "Consumers"];
  const allIndustries = s.industry ?? [];
  const displayIndustries =
    allIndustries.length > 1 ? allIndustries.filter((i) => !BROAD.includes(i)) : allIndustries;
  const industryText = displayIndustries.join(", ");
  const fullIndustryText = allIndustries.join(", ");

  const cardStyle: CSSProperties | undefined = isPressed
    ? PRESSED_CARD_STYLE
    : isHovered
      ? HOVER_CARD_STYLE
      : undefined;

  const interactionHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => {
      setIsHovered(false);
      setIsPressed(false);
    },
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
    onFocus: () => setIsHovered(true),
    onBlur: () => {
      setIsHovered(false);
      setIsPressed(false);
    },
  };

  const inner = (
    <>
      {/* Bookmark toggle - shown when favorited or card hovered/focused */}
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-label={bookmarked ? "Remove from Favorites" : "Add to Favorites"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(s.id);
            }}
            className={cn(
              "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm transition-opacity duration-150 hover:bg-background focus-visible:opacity-100",
              bookmarked || isHovered ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <Bookmark
              className={cn(
                "h-4 w-4 transition-colors",
                bookmarked ? "fill-accent text-accent" : "text-muted-foreground",
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          {bookmarked ? "Remove from Favorites" : "Add to Favorites"}
        </TooltipContent>
      </Tooltip>

      {/* Product image banner */}

      {s.tile_image_signed_url && (
        <div className="h-[120px] w-full overflow-hidden rounded-t-xl bg-muted">
          <img
            src={s.tile_image_signed_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* Header row: Logo + Name + Badges; HQ below */}
        <div className="mb-2 flex items-start gap-3">
          <div className="flex h-[32px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
            {s.logo_signed_url ? (
              <img
                src={s.logo_signed_url}
                alt=""
                className="h-full w-auto max-w-full object-contain"
              />
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {monogram(s.startup_name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <Truncate text={s.startup_name} className="min-w-0">
                <h3 className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-accent">
                  {s.startup_name}
                </h3>
              </Truncate>
              <div className="flex shrink-0 gap-1">
                <PreviewNeedsReassignmentBadge name={s.startup_name} domain="startup" size="xs" />
                {s.investment_stage && (
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                    {s.investment_stage}
                  </Badge>
                )}
                {s.company_type && (
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
                    {s.company_type}
                  </Badge>
                )}
              </div>
            </div>
            {s.headquarters && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {s.headquarters}
              </p>
            )}
          </div>
        </div>

        {/* Short description */}
        {s.short_description && (
          <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-foreground/90">
            {s.short_description}
          </p>
        )}

        {/* Product tags */}
        {s.product_tags?.length ? (
          <div className="mb-0.5">
            <ChipRow tags={s.product_tags} tone="primary" />
          </div>
        ) : null}

        {/* Divider */}
        {(s.product_tags?.length || s.short_description) && (
          <div className="my-2 border-t border-border/40" />
        )}

        {/* Est. year row */}
        {s.year_founded && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-foreground">
            <img src={anchorIcon} alt="" aria-hidden className="h-3 w-3 shrink-0" />
            <span>
              Est. <span className="text-muted-foreground">{s.year_founded}</span>
            </span>
          </div>
        )}

        {/* Industry row */}
        {industryText && (
          <div className="mb-1 flex items-center gap-1.5 overflow-hidden text-xs text-foreground/80">
            <Factory className="h-3 w-3 shrink-0" />
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="cursor-default truncate">
                  <span className="font-medium text-foreground">Industry:</span> {industryText}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-xs">
                {fullIndustryText}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Market tags row */}
        {s.market_tags?.length ? (
          <div className="mb-1 flex items-start gap-1.5 overflow-hidden">
            <span className="mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
              <ShoppingCart className="h-3 w-3 shrink-0" />
            </span>
            <OverflowRow
              items={s.market_tags}
              maxRows={2}
              itemClassName="bg-muted/50 text-muted-foreground border-transparent"
              leading={
                <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
                  <span>Market:</span>
                </span>
              }
            />
          </div>
        ) : null}

        {/* Investor relationships row (display-only) */}
        {s.related_investors?.length ? (
          <div className="mt-1 flex items-start gap-1.5 overflow-hidden">
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              <span>Investors:</span>
            </span>
            <div className="min-w-0 flex-1">
              <OverflowRow
                items={[...s.related_investors]
                  .sort((a, b) => {
                    const d = a.name.length - b.name.length;
                    return d !== 0
                      ? d
                      : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                  })
                  .map((i) => i.name)}
                maxRows={1}
                itemClassName="bg-background text-foreground/80 border-border/70"
              />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <TooltipProvider disableHoverableContent>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={CARD_CLASS}
          style={cardStyle}
          {...interactionHandlers}
        >
          {inner}
        </button>
      ) : (
        <Link
          to="/startups/$id"
          params={{ id: s.id }}
          className={CARD_CLASS}
          style={cardStyle}
          {...interactionHandlers}
        >
          {inner}
        </Link>
      )}
    </TooltipProvider>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const shown = tags.slice(0, 5);
  const overflow = tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <Tooltip key={t} delayDuration={200}>
          <TooltipTrigger asChild>
            <span
              className={`max-w-[10rem] truncate rounded-full border px-1.5 py-0 text-[10px] font-medium ${base}`}
            >
              {t}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{t}</TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground">+{overflow}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-words">
            {tags.slice(5).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
