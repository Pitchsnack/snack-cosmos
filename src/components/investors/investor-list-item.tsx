import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvestorListItem as InvestorListItemDTO } from "@/lib/investors.functions";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function InvestorListItem({
  i,
  selected,
  onSelect,
}: {
  i: InvestorListItemDTO;
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
          <span className="text-xs font-semibold text-muted-foreground">{monogram(i.investor_name)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight">{i.investor_name}</h3>
            {i.investor_type && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">{i.investor_type}</Badge>
            )}
          </div>
          {i.country && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />{i.country}
            </div>
          )}
          {i.short_description && (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-foreground/80">{i.short_description}</p>
          )}
          {(i.aum || i.ticket_size) && (
            <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
              {i.aum && <span>AUM {i.aum}</span>}
              {i.ticket_size && <span>· Ticket {i.ticket_size}</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
