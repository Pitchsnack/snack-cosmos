import { useState, type CSSProperties } from "react";
import { MapPin, Building2, Coins, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InvestorListItem as InvestorListItemDTO } from "@/lib/investors.functions";
import { RelationshipChips } from "@/components/relationships/relationship-chips";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const HOVER_STYLE: CSSProperties = {
  borderColor: "var(--accent)",
  boxShadow:
    "0 8px 20px rgba(15, 23, 42, 0.10), 0 0 0 1px color-mix(in hsl, var(--accent), transparent 65%)",
};

export function InvestorRow({
  i,
  onSelect,
}: {
  i: InvestorListItemDTO;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ticket =
    i.ticket_size || [i.min_ticket_size, i.max_ticket_size].filter(Boolean).join(" – ") || null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={hovered ? HOVER_STYLE : undefined}
      className={cn(
        "group relative flex w-full items-start gap-4 rounded-lg border border-border bg-card p-3 text-left shadow-card transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
      )}
    >
      <FavoriteToggle id={i.id} entity="investors" size="md" className="absolute right-3 top-3" />

      {/* Logo */}
      <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {i.logo_signed_url ? (
          <img src={i.logo_signed_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
            {monogram(i.investor_name)}
          </span>
        )}
      </div>

      {/* Identity + description */}
      <div className="min-w-0 flex-1 max-w-[36%]">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold leading-tight group-hover:text-accent">
            {i.investor_name}
          </h3>
          <PreviewNeedsReassignmentBadge name={i.investor_name} domain="investor" size="xs" />
          {i.investor_type && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {i.investor_type}
            </Badge>
          )}
          {i.status && i.status !== "Prospect" ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {i.status}
            </Badge>
          ) : null}
        </div>
        {i.country && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5" />
            {i.country}
          </div>
        )}
        {i.short_description && (
          <p className="mt-1 line-clamp-2 text-[11px] text-foreground/80">{i.short_description}</p>
        )}
      </div>

      {/* Focus tags */}
      <div className="min-w-0 flex-1 max-w-[32%] space-y-1.5">
        {i.preferred_stages?.length ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Preferred Stages
            </div>
            <ChipRow tags={i.preferred_stages} tone="primary" />
          </div>
        ) : null}
        {i.preferred_industries?.length ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Preferred Industries
            </div>
            <ChipRow tags={i.preferred_industries} tone="muted" />
          </div>
        ) : null}
      </div>

      {/* Meta */}
      <div className="flex w-52 shrink-0 flex-col justify-between self-stretch pr-6">
        <div className="space-y-1.5">
          {i.aum || ticket ? (
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Coins className="h-3 w-3" />
              {i.aum ? `AUM ${i.aum}` : ""}
              {i.aum && ticket ? " · " : ""}
              {ticket ? `Ticket ${ticket}` : ""}
            </div>
          ) : null}
          {i.related_startups?.length ? (
            <RelationshipChips
              className="justify-start"
              icon={<Building2 className="h-3 w-3" />}
              label="Startups:"
              items={i.related_startups}
              popoverTitle="All Startups"
              maxVisible={2}
            />
          ) : (
            <div className="text-[11px] text-muted-foreground">
              <Building2 className="mr-1 inline h-3 w-3" />
              Startups: —
            </div>
          )}
        </div>
        <span className="mt-2 inline-flex items-center gap-1 self-end text-xs font-medium text-blue-900 group-hover:underline">
          View details <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const shown = tags.slice(0, 6);
  const overflow = tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className={`max-w-[10rem] truncate rounded-full border px-1.5 py-0 text-[10px] font-medium ${base}`}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && <span className="text-[10px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}
