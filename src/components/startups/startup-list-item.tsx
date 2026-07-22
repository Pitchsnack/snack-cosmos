import { useState, type CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StartupListItem as StartupListItemDTO } from "@/lib/startups.functions";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";

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
        "group w-full rounded-lg border bg-card p-3 text-left shadow-card transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
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
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {monogram(s.startup_name)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight group-hover:text-accent">
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
            <div className="mt-0.5 text-[11px] text-muted-foreground">{s.company_type}</div>
          )}
          {s.headquarters && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {s.headquarters}
            </div>
          )}
          {s.short_description && (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-foreground/80">
              {s.short_description}
            </p>
          )}
          {s.product_tags?.length || s.market_tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(s.product_tags ?? []).slice(0, 3).map((t) => (
                <span
                  key={`p-${t}`}
                  className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0 text-[9px] font-medium text-primary"
                >
                  {t}
                </span>
              ))}
              {(s.market_tags ?? []).slice(0, 2).map((t) => (
                <span
                  key={`m-${t}`}
                  className="rounded-full border border-transparent bg-muted/50 px-1.5 py-0 text-[9px] font-medium text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
