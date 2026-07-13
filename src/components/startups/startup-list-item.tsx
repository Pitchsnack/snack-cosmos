import { useState, type CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StartupListItem as StartupListItemDTO } from "@/lib/startups.functions";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function StartupListItem({
  s,
  selected,
  onSelect,
}: {
  s: StartupListItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border-2 bg-card p-3 text-left shadow-card transition-all",
        "hover:border-accent/40 hover:shadow-md",
        selected ? "border-accent ring-1 ring-accent/30" : "border-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight">{s.startup_name}</h3>
            <div className="flex shrink-0 gap-1">
              {s.investment_stage && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{s.investment_stage}</Badge>
              )}
            </div>
          </div>
          {s.company_type && <div className="mt-0.5 text-[11px] text-muted-foreground">{s.company_type}</div>}
          {s.headquarters && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />{s.headquarters}
            </div>
          )}
          {s.short_description && (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-foreground/80">{s.short_description}</p>
          )}
          {(s.product_tags?.length || s.market_tags?.length) ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(s.product_tags ?? []).slice(0, 3).map((t) => (
                <span key={`p-${t}`} className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0 text-[9px] font-medium text-primary">{t}</span>
              ))}
              {(s.market_tags ?? []).slice(0, 2).map((t) => (
                <span key={`m-${t}`} className="rounded-full border border-transparent bg-muted/50 px-1.5 py-0 text-[9px] font-medium text-muted-foreground">{t}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
