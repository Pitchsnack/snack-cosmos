import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star, X, ArrowRight, Bookmark } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StartupCard } from "@/components/startups/startup-card";
import { StartupListItem } from "@/components/startups/startup-list-item";
import { StartupRow } from "@/components/startups/startup-row";
import { StartupDetailPanel, StartupDetailEmpty } from "@/components/startups/startup-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { useStartups } from "@/hooks/use-startups";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { PermissionGuard } from "@/components/permission-guard";
import { cn } from "@/lib/utils";

const VIEW = ["grid", "split", "list"] as const;

const searchSchema = z.object({
  view: z.enum(VIEW).optional(),
  selected: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — SnackPortal2" },
      { name: "description", content: "Startups you have bookmarked across all views." },
    ],
  }),
  validateSearch: searchSchema,
  component: FavoritesPage,
});

function FavoritesPage() {
  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <FavoritesInner />
    </PermissionGuard>
  );
}

function FavoritesInner() {
  const navigate = useNavigate({ from: "/favorites" });
  const s = Route.useSearch();
  const view = s.view ?? "grid";
  const selected = s.selected;
  const [modalId, setModalId] = useState<string | null>(null);

  const { ids } = useFavoriteStartups();

  // Fetch a large page and filter client-side by favorite ids.
  const { data, isLoading } = useStartups({ sort: "updated_desc", page: 1, pageSize: 100 });
  const allItems = data && "items" in data ? data.items : [];

  const items = useMemo(
    () => allItems.filter((it) => ids.has(it.id)),
    [allItems, ids],
  );

  const total = items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Startup Directory · Favorites
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent"
              aria-hidden="true"
            >
              <Star className="h-5 w-5 fill-accent" />
            </span>
            Favorites
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${total} bookmarked startup${total === 1 ? "" : "s"}.`
              : "Startups you have bookmarked across all views."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            value={view}
            onChange={(v) => navigate({ search: (p: typeof s) => ({ ...p, view: v }) })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <StartupCard key={it.id} s={it} onClick={() => setModalId(it.id)} />
          ))}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {items.map((it) => (
            <StartupRow key={it.id} s={it} onSelect={() => setModalId(it.id)} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
            {items.map((it) => (
              <StartupListItem
                key={it.id}
                s={it}
                selected={selected === it.id}
                onSelect={() =>
                  navigate({ search: (p: typeof s) => ({ ...p, selected: it.id }) })
                }
              />
            ))}
          </div>
          <div className="min-w-0">
            {selected ? <StartupDetailPanel id={selected} /> : <StartupDetailEmpty />}
          </div>
        </div>
      )}

      <Dialog open={!!modalId} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent
          className={cn(
            "[&>button]:hidden",
            "p-0 gap-0 flex flex-col overflow-hidden",
            "sm:max-w-2xl sm:max-h-[85vh] sm:rounded-2xl",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
          )}
        >
          <ModalBody modalId={modalId} onClose={() => setModalId(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 text-center shadow-card">
      <span
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Bookmark className="h-6 w-6" />
      </span>
      <p className="text-base font-medium text-foreground">No favorite startups yet.</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Bookmark startups from the Startup Directory to see them here.
      </p>
      <Button
        variant="outline"
        className="mt-6 gap-1"
        onClick={() => navigate({ to: "/startups" })}
      >
        Go to Startup Directory <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ModalBody({ modalId, onClose }: { modalId: string | null; onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;
  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative shrink-0 h-10">
        <DialogClose
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Close"
          className={cn(
            "absolute right-3 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-opacity duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            visible ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <X className="h-4 w-4" />
        </DialogClose>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {modalId && <StartupDetailPanel id={modalId} showEdit={false} compact onClose={onClose} />}
      </div>
    </div>
  );
}
