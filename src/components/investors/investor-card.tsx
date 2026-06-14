import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink } from "lucide-react";
import type { InvestorListItem } from "@/lib/investors.functions";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function InvestorCard({ i, href = true }: { i: InvestorListItem; href?: boolean }) {
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          <span className="text-base font-semibold text-muted-foreground">{monogram(i.investor_name)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight">{i.investor_name}</h3>
          {i.investor_type && (
            <div className="mt-0.5 text-xs text-muted-foreground">{i.investor_type}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {i.country && (
              <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{i.country}</span>
            )}
            {i.website_url && (
              <span className="inline-flex items-center gap-0.5 truncate"><ExternalLink className="h-3 w-3" />{i.website_url.replace(/^https?:\/\//, "").slice(0, 28)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {i.investor_type && (
          <Badge variant="outline" className="text-[10px]">{i.investor_type}</Badge>
        )}
        {i.status && i.status !== "Prospect" && (
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">{i.status}</Badge>
        )}
      </div>

      {i.short_description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{i.short_description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
        {i.aum && <span><span className="font-medium text-foreground">AUM:</span> {i.aum}</span>}
        {i.ticket_size && <span><span className="font-medium text-foreground">Ticket:</span> {i.ticket_size}</span>}
      </div>
    </>
  );

  const className =
    "group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition hover:border-accent/50 hover:shadow-md";

  if (href) {
    return (
      <Link to="/investors/$id" params={{ id: i.id }} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
