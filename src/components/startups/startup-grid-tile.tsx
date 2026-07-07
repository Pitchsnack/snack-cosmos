import { forwardRef } from "react";
import { MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StartupListItem } from "@/lib/startups.functions";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export interface StartupGridTileProps {
  s: StartupListItem;
  onOpen: (id: string) => void;
}

export const StartupGridTile = forwardRef<HTMLButtonElement, StartupGridTileProps>(
  function StartupGridTile({ s, onOpen }, ref) {
    const handleActivate = () => onOpen(s.id);

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate();
          }
        }}
        aria-label={`Open ${s.startup_name} details`}
        className={cn(
          "group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 text-left shadow-card",
          "transition-all duration-200 ease-out",
          "hover:border-accent/50 hover:shadow-elevated",
          "active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* SnackPortal2 enhancement: subtle corner-highlight on hover */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-10 w-10 rounded-bl-[2rem] bg-accent/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />

        <div className="flex items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {s.logo_signed_url ? (
              <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-tight group-hover:text-accent">
              {s.startup_name}
            </h3>
            {s.company_type && (
              <div className="mt-0.5 text-xs text-muted-foreground">{s.company_type}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {s.headquarters && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {s.headquarters}
                </span>
              )}
              {s.year_founded && (
                <span className="inline-flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  Founded {s.year_founded}
                </span>
              )}
            </div>
          </div>
        </div>

        {(s.investment_stage || (s.industry && s.industry.length > 0)) && (
          <div className="flex flex-wrap gap-1.5">
            {s.investment_stage && (
              <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">
                {s.investment_stage}
              </Badge>
            )}
            {s.industry?.map((ind) => (
              <Badge key={ind} variant="outline" className="text-[10px]">
                {ind}
              </Badge>
            ))}
          </div>
        )}

        {s.short_description && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{s.short_description}</p>
        )}

        {(s.product_tags?.length || s.market_tags?.length) ? (
          <div className="mt-auto space-y-1.5 pt-1">
            {s.product_tags?.length ? <ChipRow tags={s.product_tags} tone="primary" /> : null}
            {s.market_tags?.length ? <ChipRow tags={s.market_tags} tone="muted" /> : null}
          </div>
        ) : null}
      </button>
    );
  },
);

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const shown = tags.slice(0, 5);
  const overflow = tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${base}`}>
          {t}
        </span>
      ))}
      {overflow > 0 && <span className="text-[10px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}
