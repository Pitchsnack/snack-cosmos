import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Layers, Coins, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InvestorListItem } from "@/lib/investors.functions";
import { OverflowRow } from "@/components/startups/overflow-row";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";
import { useFavoriteInvestors } from "@/hooks/use-favorites";
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

export function InvestorCard({
  i,
  onClick,
  compact = false,
}: {
  i: InvestorListItem;
  onClick?: () => void;
  compact?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { isFavorite } = useFavoriteInvestors();
  const bookmarked = isFavorite(i.id);

  const ticket =
    i.ticket_size ||
    [i.min_ticket_size, i.max_ticket_size].filter(Boolean).join(" – ") ||
    null;

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
      <FavoriteToggle
        id={i.id}
        entity="investors"
        withProvider={false}
        size="md"
        className={cn(
          "absolute right-2 top-2 h-7 w-7 bg-background/90 shadow-sm hover:bg-background",
          bookmarked || isHovered ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* Header row: logo + name + badges */}
        <div className="mb-2 flex items-start gap-3">
          <div className="flex h-[32px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
            {i.logo_signed_url ? (
              <img
                src={i.logo_signed_url}
                alt=""
                loading="lazy"
                className="h-full w-auto max-w-full object-contain"
              />
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {monogram(i.investor_name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1.5">
              <Truncate text={i.investor_name} className="min-w-0">
                <h3 className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-accent">
                  {i.investor_name}
                </h3>
              </Truncate>
              <div className="flex shrink-0 gap-1 pr-6">
                <PreviewNeedsReassignmentBadge name={i.investor_name} domain="investor" size="xs" />
                {i.investor_type && (
                  <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                    {i.investor_type}
                  </Badge>
                )}
                {i.status && i.status !== "Prospect" ? (
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
                    {i.status}
                  </Badge>
                ) : null}
              </div>
            </div>
            {i.country && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {i.country}
              </p>
            )}
          </div>
        </div>

        {/* Short description */}
        {i.short_description && (
          <p className="mb-2 line-clamp-2 text-[11px] leading-relaxed text-foreground/90">
            {i.short_description}
          </p>
        )}

        {/* Preferred stages */}
        {!compact && i.preferred_stages?.length ? (
          <div className="mb-0.5">
            <ChipRow tags={i.preferred_stages} tone="primary" />
          </div>
        ) : null}

        {(!compact && i.preferred_stages?.length) || i.short_description ? (
          <div className="my-2 border-t border-border/40" />
        ) : null}

        {/* AUM */}
        {i.aum && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-foreground">
            <Coins className="h-3 w-3 shrink-0" />
            <span>
              <span className="font-medium text-foreground">AUM:</span>{" "}
              <span className="text-muted-foreground">{i.aum}</span>
            </span>
          </div>
        )}

        {/* Ticket size */}
        {ticket && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-foreground/80">
            <Layers className="h-3 w-3 shrink-0" />
            <span className="truncate">
              <span className="font-medium text-foreground">Ticket:</span> {ticket}
            </span>
          </div>
        )}

        {/* Website */}
        {i.website_url && (
          <div className="mb-1 flex items-center gap-1.5 overflow-hidden text-xs text-foreground/80">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{i.website_url.replace(/^https?:\/\//, "")}</span>
          </div>
        )}

        {/* Preferred industries */}
        {i.preferred_industries?.length ? (
          <div className="mb-1 flex items-start gap-1.5 overflow-hidden">
            <span className="mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
              <Layers className="h-3 w-3 shrink-0" />
            </span>
            <OverflowRow
              items={i.preferred_industries}
              maxRows={2}
              itemClassName="bg-muted/50 text-muted-foreground border-transparent"
              leading={
                <span className="mr-0.5 mt-0.5 inline-flex shrink-0 items-center text-[10px] text-muted-foreground">
                  <span>Focus:</span>
                </span>
              }
            />
          </div>
        ) : null}

        {/* Portfolio startups (display-only) */}
        {i.related_startups?.length ? (
          <div className="mt-1 flex items-start gap-1.5 overflow-hidden">
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span>Startups:</span>
            </span>
            <div className="min-w-0 flex-1">
              <OverflowRow
                items={[...i.related_startups]
                  .sort((a, b) => {
                    const d = a.name.length - b.name.length;
                    return d !== 0
                      ? d
                      : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                  })
                  .map((s) => s.name)}
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
          className={compact ? COMPACT_CARD_CLASS : CARD_CLASS}
          style={cardStyle}
          {...interactionHandlers}
        >
          {inner}
        </button>
      ) : (
        <Link
          to="/investors/$id"
          params={{ id: i.id }}
          className={compact ? COMPACT_CARD_CLASS : CARD_CLASS}
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
