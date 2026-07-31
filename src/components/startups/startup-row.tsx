import { useState, type CSSProperties } from "react";
import { MapPin, Users, Calendar, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MaskedImage, restrictedSet } from "@/components/startups/restricted-placeholder";
import type { StartupListItem as StartupListItemDTO } from "@/lib/startups.functions";
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

export function StartupRow({
  s,
  onSelect,
}: {
  s: StartupListItemDTO;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const restricted = restrictedSet(s);


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
      {/* Favorite */}
      <FavoriteToggle id={s.id} size="md" className="absolute right-3 top-3" />


      {/* Logo */}
      <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {restricted.has("logo") ? (
          <MaskedImage seed={`${s.id}-logo`} cells={7} />
        ) : s.logo_signed_url ? (
          <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
            {monogram(s.startup_name)}
          </span>
        )}
      </div>

      {/* Identity + description */}
      <div className="min-w-0 flex-1 max-w-[36%]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            <h3 className="truncate text-sm font-semibold leading-tight group-hover:text-accent">
              {s.startup_name}
            </h3>
          )}
          <PreviewNeedsReassignmentBadge name={s.startup_name} domain="startup" size="xs" />
          {s.investment_stage && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {s.investment_stage}
            </Badge>
          )}
          {s.company_type ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {s.company_type}
            </Badge>
          ) : null}
        </div>
        {s.headquarters && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5" />
            {s.headquarters}
          </div>
        )}
        {s.industry?.length ? (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium">Industry:</span> {s.industry.join(" · ")}
          </div>
        ) : null}
        {s.short_description && (
          <p className="mt-1 line-clamp-2 text-[11px] text-foreground/80">
            {s.short_description}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="min-w-0 flex-1 max-w-[32%] space-y-1.5">
        {s.product_tags?.length ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Product & Service Tags
            </div>
            <ChipRow tags={s.product_tags} tone="primary" />
          </div>
        ) : null}
        {s.market_tags?.length ? (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Tags
            </div>
            <ChipRow tags={s.market_tags} tone="muted" />
          </div>
        ) : null}
      </div>

      {/* Meta: year + investors + view details */}
      <div className="flex w-52 shrink-0 flex-col justify-between self-stretch pr-6">
        <div className="space-y-1.5">
          {s.year_founded ? (
            <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> Est. {s.year_founded}
            </div>
          ) : null}
          {s.related_investors?.length ? (
            <RelationshipChips
              className="justify-start"
              icon={<Users className="h-3 w-3" />}
              label="Investors:"
              items={s.related_investors}
              popoverTitle="All Investors"
              maxVisible={2}
            />
          ) : (
            <div className="text-[11px] text-muted-foreground">
              <Users className="mr-1 inline h-3 w-3" />
              Investors: —
            </div>
          )}
        </div>
        <span className="mt-2 inline-flex items-center gap-1 self-end text-xs font-medium text-accent group-hover:underline">
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
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
