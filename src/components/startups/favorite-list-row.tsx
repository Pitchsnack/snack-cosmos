import type { StartupListItem as StartupListItemDTO } from "@/lib/startups.functions";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";
import { cn } from "@/lib/utils";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const COLS =
  "grid grid-cols-[minmax(180px,1.4fr)_90px_110px_120px_minmax(160px,2fr)_minmax(140px,1.5fr)_minmax(120px,1.2fr)_minmax(120px,1fr)_44px_92px] items-center gap-3";

export function FavoriteListHeader() {
  return (
    <div
      className={cn(
        COLS,
        "border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
      )}
    >
      <div>Startup</div>
      <div>Stage/Type</div>
      <div>Country</div>
      <div>Industry</div>
      <div>Description</div>
      <div>Product tags</div>
      <div>Market tags</div>
      <div>Investors</div>
      <div className="text-center">Save</div>
      <div className="text-right">Action</div>
    </div>
  );
}

export function FavoriteListRow({
  s,
  onSelect,
}: {
  s: StartupListItemDTO;
  onSelect: () => void;
}) {
  const { toggle } = useFavoriteStartups();
  return (
    <div
      className={cn(
        COLS,
        "border-b border-border/60 bg-card px-3 py-2 text-[12px] transition-colors hover:bg-muted/30",
      )}
    >
      {/* Startup */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground">
              {monogram(s.startup_name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-tight">{s.startup_name}</div>
          {s.year_founded && (
            <div className="truncate text-[10px] text-muted-foreground">Est. {s.year_founded}</div>
          )}
        </div>
      </div>

      {/* Stage / Type */}
      <div className="min-w-0 truncate text-muted-foreground">
        {[s.investment_stage, s.company_type].filter(Boolean).join(" · ") || "—"}
      </div>

      {/* Country */}
      <div className="min-w-0 truncate text-muted-foreground">{s.headquarters || "—"}</div>

      {/* Industry */}
      <div className="min-w-0 truncate text-muted-foreground">
        {s.industry?.length ? s.industry.join(", ") : "—"}
      </div>

      {/* Short description */}
      <div className="min-w-0 truncate text-foreground/85">{s.short_description || "—"}</div>

      {/* Product tags */}
      <ChipCell tags={s.product_tags ?? []} tone="primary" />

      {/* Market tags */}
      <ChipCell tags={s.market_tags ?? []} tone="muted" />

      {/* Investors */}
      <div className="min-w-0 truncate text-muted-foreground">
        {s.related_investors?.length
          ? `${s.related_investors
              .slice(0, 2)
              .map((i) => i.name)
              .join(", ")}${s.related_investors.length > 2 ? ` +${s.related_investors.length - 2}` : ""}`
          : "—"}
      </div>

      {/* Save */}
      <div className="flex justify-center">
        <button
          type="button"
          aria-label="Remove from favorites"
          onClick={(e) => {
            e.stopPropagation();
            toggle(s.id);
          }}
          className="rounded-full p-1 hover:bg-muted/60"
        >
          <Star className="h-4 w-4 fill-accent text-accent" />
        </button>
      </div>

      {/* Action */}
      <div className="text-right">
        <button
          type="button"
          onClick={onSelect}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground/85 hover:border-accent/50 hover:text-accent"
        >
          View details
        </button>
      </div>
    </div>
  );
}

function ChipCell({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const shown = tags.slice(0, 2);
  const overflow = tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted/60 text-muted-foreground border-transparent";
  if (!tags.length) return <div className="text-muted-foreground">—</div>;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className={`max-w-[7rem] truncate rounded-full border px-1.5 py-0 text-[10px] font-medium ${base}`}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && <span className="text-[10px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}
