import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Rocket, RefreshCw, X, Star, Building2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { StartupCard } from "@/components/startups/startup-card";
import { StartupListItem } from "@/components/startups/startup-list-item";
import { StartupRow } from "@/components/startups/startup-row";
import { FavoriteSplitRow } from "@/components/startups/favorite-split-row";
import { FavoriteListHeader, FavoriteListRow } from "@/components/startups/favorite-list-row";
import { StartupDetailPanel, StartupDetailEmpty } from "@/components/startups/startup-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { useStartups } from "@/hooks/use-startups";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { PublicationStatusBadge } from "@/components/startups/publication-actions";
import { selectMyStartups } from "@/lib/publication/my-startups-membership";
import { cn } from "@/lib/utils";

const SORT = ["updated_desc","created_desc","name_asc","name_desc"] as const;
const VIEW = ["grid","split","list"] as const;
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Other"];
const COMPANY_TYPES = ["SaaS","FinTech","Marketplace","AI","Hardware","Consumer","Other"];

const searchSchema = z.object({
  q: z.string().optional(),
  stage: z.string().optional(),
  industry: z.string().optional(),
  hq: z.string().optional(),
  ct: z.string().optional(),
  ptag: z.string().optional(),
  mtag: z.string().optional(),
  sort: z.enum(SORT).optional(),
  view: z.enum(VIEW).optional(),
  selected: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  fav: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/my-startups/")({
  head: () => ({
    meta: [
      { title: "My Startups — SnackPortal2" },
      { name: "description", content: "Manage the startup profiles you own and keep company information up to date." },
    ],
  }),
  validateSearch: searchSchema,
  component: MyStartupsPage,
});

function MyStartupsPage() {
  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <MyStartupsPageInner />
    </PermissionGuard>
  );
}

function MyStartupsPageInner() {
  const { has, roles } = usePermissions();
  const { data: session } = useSessionContext();
  const meId = session?.user?.id ?? null;
  const isStartupUser = roles.includes("STARTUP_USER");
  const navigate = useNavigate({ from: "/my-startups" });
  const s = Route.useSearch();
  const page = s.page ?? 1;
  const sort = s.sort ?? "updated_desc";
  const view = s.view ?? "grid";
  const selected = s.selected;
  const favOnly = !!s.fav;
  const [modalId, setModalId] = useState<string | null>(null);
  const { ids: favIds } = useFavoriteStartups();

  const pageSize = 100; // fetch enough to filter client-side to mine

  const { data, isLoading, isFetching, refetch } = useStartups({
    search: s.q, stage: s.stage, industry: s.industry, headquarters: s.hq,
    companyType: s.ct, productTag: s.ptag, marketTag: s.mtag,
    sort, page: 1, pageSize,
  });

  const rawItems = data && "items" in data ? data.items : [];
  // Membership uses approved ownership relationships ONLY.
  // `created_by` is audit metadata and is never part of this predicate.
  // Publication status never affects membership (private/published/unpublished
  // founder-owned startups all stay here). See src/lib/publication/my-startups-membership.ts
  // for the documented missing founder-relationship and creation-origin contracts.
  const mineItems = useMemo(
    () => selectMyStartups(rawItems, meId, isStartupUser),
    [rawItems, meId, isStartupUser],
  );


  const items = useMemo(
    () => (favOnly ? mineItems.filter((it) => favIds.has(it.id)) : mineItems),
    [mineItems, favOnly, favIds],
  );
  const total = items.length;

  const update = (patch: Partial<typeof s>) =>
    navigate({ search: (prev: typeof s) => ({ ...prev, ...patch, page: 1 }) });

  const hasFilter = !!(s.q || s.stage || s.industry || s.hq || s.ct || s.ptag || s.mtag);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> MY WORKSPACE{favOnly ? " · Favorites" : ""}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Startups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${total} startup${total === 1 ? "" : "s"} you own or manage`
              : "Add and manage the startup profiles you own. Keep company details, media, founders and investors up to date."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={favOnly}
            aria-label={favOnly ? "Show all my startups" : "Show only favorites"}
            title={favOnly ? "Show all my startups" : "Show only favorites"}
            onClick={() =>
              navigate({ search: (p: typeof s) => ({ ...p, fav: favOnly ? undefined : true, page: 1 }) })
            }
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              favOnly
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-input bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("h-4 w-4", favOnly && "fill-accent")} />
            <span>&nbsp;</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                favOnly ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground",
              )}
            >
              {mineItems.filter((it) => favIds.has(it.id)).length}
            </span>
          </button>
          <ViewToggle
            value={view}
            onChange={(v) => navigate({ search: (p: typeof s) => ({ ...p, view: v }) })}
          />
          {has("startups.write") && (
            <Button
              onClick={() => navigate({ to: "/my-startups/new" })}

              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="mr-2 h-4 w-4" /> Add my startup
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 min-w-[16rem] items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={s.q ?? ""}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder="Search my startups by name, description, industry, HQ…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <FilterSelect label="Stage" value={s.stage} options={STAGES} onChange={(v) => update({ stage: v })} />
        <FilterSelect label="Type" value={s.ct} options={COMPANY_TYPES} onChange={(v) => update({ ct: v })} />
        <Input value={s.industry ?? ""} onChange={(e) => update({ industry: e.target.value || undefined })} placeholder="Industry" className="h-9 w-36" />
        <Input value={s.hq ?? ""} onChange={(e) => update({ hq: e.target.value || undefined })} placeholder="HQ" className="h-9 w-32" />
        <Select value={sort} onValueChange={(v) => navigate({ search: (prev: typeof s) => ({ ...prev, sort: v as typeof SORT[number] }) })}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="created_desc">Recently created</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ search: (p: typeof s) => ({ view: p.view }) })} className="gap-1">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 shadow-card space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Rocket className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="mb-3">You don't own or manage any startups yet.</p>
          {has("startups.write") && (
            <Button
              size="sm"
              onClick={() => navigate({ to: "/my-startups/new" })}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="mr-2 h-4 w-4" /> Add my startup
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        <div
          className={cn(
            "grid gap-4",
            favOnly
              ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {items.map((it) => (
            <div key={it.id} className="relative">
              <PublicationStatusBadge
                startupRef={it.id}
                className="absolute left-3 top-3 z-10 bg-background/95"
              />
              <StartupCard s={it} onClick={() => setModalId(it.id)} compact={favOnly} />
            </div>
          ))}
        </div>
      ) : view === "list" ? (
        favOnly ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <FavoriteListHeader />
            {items.map((it) => (
              <FavoriteListRow key={it.id} s={it} onSelect={() => setModalId(it.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="relative">
                <PublicationStatusBadge
                  startupRef={it.id}
                  className="absolute right-3 top-3 z-10 bg-background/95"
                />
                <StartupRow s={it} onSelect={() => setModalId(it.id)} />
              </div>
            ))}
          </div>
        )
      ) : (
        <div
          className={cn(
            "grid gap-4",
            favOnly
              ? "lg:grid-cols-[minmax(260px,20rem)_1fr]"
              : "lg:grid-cols-[minmax(320px,26rem)_1fr]",
          )}
        >
          <div className="h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto pr-1">
            {favOnly
              ? items.map((it) => (
                  <FavoriteSplitRow
                    key={it.id}
                    s={it}
                    selected={selected === it.id}
                    onSelect={() =>
                      navigate({ search: (p: typeof s) => ({ ...p, selected: it.id }) })
                    }
                  />
                ))
              : items.map((it) => (
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
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4">
            {selected ? <StartupDetailPanel id={selected} showPublication /> : <StartupDetailEmpty />}
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
          <MyStartupModalBody modalId={modalId} onClose={() => setModalId(null)} />
        </DialogContent>
      </Dialog>
      {/* Keep unused paging variable silenced */}
      <span className="hidden">{page}</span>
    </div>
  );
}

function MyStartupModalBody({ modalId, onClose }: { modalId: string | null; onClose: () => void }) {
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
        {modalId && <StartupDetailPanel id={modalId} showEdit compact showPublication onClose={onClose} />}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void }) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className="h-9 w-36"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
