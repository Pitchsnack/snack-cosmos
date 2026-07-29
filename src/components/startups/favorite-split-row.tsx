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

export function FavoriteSplitRow({
  s,
  selected,
  onSelect,
}: {
  s: StartupListItemDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const { toggle } = useFavoriteStartups();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-accent bg-accent/5"
          : "border-border/70 bg-card hover:border-accent/40 hover:bg-muted/40",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
        {s.logo_signed_url ? (
          <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {monogram(s.startup_name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight group-hover:text-accent">
          {s.startup_name}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {[s.investment_stage, s.company_type, s.headquarters].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span
        role="button"
        tabIndex={0}
        aria-label="Remove from favorites"
        onClick={(e) => {
          e.stopPropagation();
          toggle(s.id);
        }}
        className="shrink-0 rounded-full p-1 hover:bg-muted/60"
      >
        <Star className="h-3.5 w-3.5 fill-accent text-accent" />
      </span>
    </button>
  );
}
