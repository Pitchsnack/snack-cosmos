import { Bookmark } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

/**
 * The single Favorite control used on every startup surface (Grid, Split, List,
 * Favorites views and the detail panel) in both My Startups and the Startup
 * Directory. Do not fork this component — favorite state must stay consistent
 * across surfaces.
 */
export function FavoriteToggle({
  id,
  className,
  iconClassName,
  size = "sm",
  /** Hide the control unless favorited/hovered (grid cards). */
  hidden = false,
  /** Render without the TooltipProvider (when a parent already provides one). */
  withProvider = true,
}: {
  id: string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md";
  hidden?: boolean;
  withProvider?: boolean;
}) {
  const { isFavorite, toggle, isPending } = useFavoriteStartups();
  const favorited = isFavorite(id);
  const pending = isPending(id);
  const label = favorited ? "Remove from Favorites" : "Add to Favorites";

  const activate = () => {
    if (!pending) void toggle(id);
  };

  const control = (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={label}
          aria-pressed={favorited}
          aria-busy={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            activate();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              activate();
            }
          }}
          className={cn(
            "z-10 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 transition-opacity duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            pending && "opacity-60",
            hidden && !favorited && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
            className,
          )}
        >
          <Bookmark
            className={cn(
              size === "md" ? "h-4 w-4" : "h-3.5 w-3.5",
              "transition-colors",
              favorited ? "fill-accent text-accent" : "text-muted-foreground",
              iconClassName,
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );

  return withProvider ? (
    <TooltipProvider disableHoverableContent>{control}</TooltipProvider>
  ) : (
    control
  );
}
