import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Rocket, RefreshCw, X, Star, ArrowLeft } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StartupCard } from "@/components/startups/startup-card";
import { useRestrictionMask } from "@/hooks/use-startup-restrictions";
import { StartupListItem } from "@/components/startups/startup-list-item";
import { StartupRow } from "@/components/startups/startup-row";
import { FavoriteSplitRow } from "@/components/startups/favorite-split-row";
import { FavoriteListHeader, FavoriteListRow } from "@/components/startups/favorite-list-row";
import { StartupDetailPanel, StartupDetailEmpty } from "@/components/startups/startup-detail-panel";
import { InvestorDetailPanel } from "@/components/investors/investor-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { useStartups } from "@/hooks/use-startups";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import {
  isPublicationPreview,
  readPreviewPublication,
  listPreviewPublishedRefs,
  PREVIEW_DISCLAIMER,
} from "@/lib/publication";
import { usePreviewPublicationVersion } from "@/hooks/use-publication";
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
  panel: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),

  fav: z.coerce.boolean().optional(),
});


export const Route = createFileRoute("/_authenticated/startups/")({
  head: () => ({ meta: [{ title: "Startups — SnackPortal2" }] }),
  validateSearch: searchSchema,
  component: StartupsPage,
});

function StartupsPage() {
  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <StartupsPageInner />
    </PermissionGuard>
  );
}

function StartupsPageInner() {
  const { has } = usePermissions();
  const navigate = useNavigate({ from: "/startups" });
  const s = Route.useSearch();
  const page = s.page ?? 1;
  const sort = s.sort ?? "updated_desc";
  const view = s.view ?? "grid";
  const selected = s.selected;
  const favOnly = !!s.fav;
  // The information panel is URL-addressable so returning from Edit restores it
  // over the still-rendered Startup Directory cards.
  const [modalId, setModalId] = useState<string | null>(s.panel ?? null);
  useEffect(() => {
    if (s.panel) setModalId(s.panel);
  }, [s.panel]);
  const closeStartup = () => {
    setModalId(null);
    if (s.panel) navigate({ search: (prev: typeof s) => ({ ...prev, panel: undefined }), replace: true });
  };
  const openStartup = (id: string) => {
    setModalId(id);
    navigate({ search: (prev: typeof s) => ({ ...prev, panel: id }), replace: true });
  };

  const { ids: favIds } = useFavoriteStartups();


  const pageSize = favOnly ? 100 : view === "split" ? 50 : view === "list" ? 25 : 24;

  // Preview-only, opt-in simulation. Never authoritative for the real directory:
  // it is off by default, available only in preview mode, and never persists.
  const [previewDirectoryFilter, setPreviewDirectoryFilter] = useState(false);
  const previewVersion = usePreviewPublicationVersion();
  // Session-scoped preview publications are the ONLY way a Private founder-owned
  // startup may enter this list, and only in explicitly labelled preview mode.
  const allowPrivateRefs = useMemo(() => {
    void previewVersion;
    return isPublicationPreview ? listPreviewPublishedRefs() : [];
  }, [previewVersion]);

  const { data, isLoading, isFetching, refetch } = useStartups({
    search: s.q, stage: s.stage, industry: s.industry, headquarters: s.hq,
    companyType: s.ct, productTag: s.ptag, marketTag: s.mtag,
    sort, page: favOnly ? 1 : page, pageSize,
    // Directory read model: Private records are excluded by the query itself,
    // not hidden after rendering.
    scope: "directory",
    allowPrivateRefs,
  });

  const rawItems = data && "items" in data ? data.items : [];
  const baseItems = useMemo(() => {
    if (!isPublicationPreview || !previewDirectoryFilter) return rawItems;
    void previewVersion; // re-evaluate when session preview state changes
    return rawItems.filter(
      (it) => readPreviewPublication(it.id).status === "published",
    );
  }, [rawItems, previewDirectoryFilter, previewVersion]);
  const { mask } = useRestrictionMask("startups");
  const items = useMemo(
    () =>
      (favOnly ? baseItems.filter((it) => favIds.has(it.id)) : baseItems).map((it) => mask(it)),
    [baseItems, favOnly, favIds, mask],
  );

  const total = favOnly ? items.length : data && "total" in data ? data.total : 0;
  const pageCount = favOnly ? 1 : Math.max(1, Math.ceil(total / pageSize));

  const update = (patch: Partial<typeof s>) =>
    navigate({ search: (prev: typeof s) => ({ ...prev, ...patch, page: 1 }) });

  const hasFilter = !!(s.q || s.stage || s.industry || s.hq || s.ct || s.ptag || s.mtag);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Rocket className="h-3.5 w-3.5" /> Startup Directory{favOnly ? " · Favorites" : ""}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Startups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {favOnly
              ? `${total} bookmarked startup${total === 1 ? "" : "s"}`
              : total > 0
                ? `${total} startup${total === 1 ? "" : "s"}`
                : "Browse and manage your portfolio."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={favOnly}
            aria-label={favOnly ? "Show all startups" : "Show only favorites"}
            title={favOnly ? "Show all startups" : "Show only favorites"}
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
              {favIds.size}
            </span>
          </button>
          <ViewToggle
            value={view}
            onChange={(v) => navigate({ search: (p: typeof s) => ({ ...p, view: v }) })}
          />
          {has("startups.write") && (
            <Button
              onClick={() => navigate({ to: "/startups/new" })}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="mr-2 h-4 w-4" /> New startup
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
            placeholder="Search name, description, industry, HQ…"
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

      {isPublicationPreview && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground"
        >
          <span>
            <strong className="text-amber-700 dark:text-amber-400">Preview mode</strong> —{" "}
            {PREVIEW_DISCLAIMER} It does not change what the real Startup Directory shows for
            anyone.
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={previewDirectoryFilter}
              onChange={(e) => setPreviewDirectoryFilter(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            Show only preview-published startups
          </label>
        </div>
      )}



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
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Rocket className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No startups match your filters.</p>
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
            <StartupCard key={it.id} s={it} onClick={() => openStartup(it.id)} compact={favOnly} />
          ))}
        </div>
      ) : view === "list" ? (
        favOnly ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <FavoriteListHeader />
            {items.map((it) => (
              <FavoriteListRow key={it.id} s={it} onSelect={() => openStartup(it.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <StartupRow key={it.id} s={it} onSelect={() => openStartup(it.id)} />
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
            {selected ? <StartupDetailPanel id={selected} /> : <StartupDetailEmpty />}
          </div>
        </div>
      )}

      {(view === "grid" || view === "list") && pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ search: (p: typeof s) => ({ ...p, page: page - 1 }) })}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => navigate({ search: (p: typeof s) => ({ ...p, page: page + 1 }) })}>Next</Button>
        </div>
      )}

      <Dialog open={!!modalId} onOpenChange={(o) => !o && closeStartup()}>
        <DialogContent
          className={cn(
            "[&>button]:hidden",
            "p-0 gap-0 flex flex-col overflow-hidden",
            "sm:max-w-2xl sm:max-h-[85vh] sm:rounded-2xl",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
          )}
        >
          <StartupPanelModalBody
            modalId={modalId}
            onClose={closeStartup}
            returnSearch={{ ...s, panel: undefined }}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}

function StartupPanelModalBody({
  modalId,
  onClose,
  returnSearch,
}: {
  modalId: string | null;
  onClose: () => void;
  returnSearch: Omit<z.infer<typeof searchSchema>, "panel"> & { panel?: undefined };
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;
  const [stack, setStack] = useState<Array<{ kind: "investor"; id: string }>>([]);

  // Reset the drill-down stack whenever the root startup changes.
  useEffect(() => {
    setStack([]);
  }, [modalId]);

  const current = stack[stack.length - 1];
  const push = (entry: { kind: "investor"; id: string }) =>
    setStack((prev) => [...prev, entry]);

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Close/back zone above the header action row */}
      <div className="relative shrink-0 h-10">
        {current && (
          <button
            type="button"
            onClick={() => setStack((prev) => prev.slice(0, -1))}
            className="absolute left-4 top-2 z-20 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <button
          type="button"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={current ? "Back to startup information panel" : "Close"}
          onClick={() => {
            if (current) {
              setStack((prev) => prev.slice(0, -1));
            } else {
              onClose();
            }
          }}
          className={cn(
            "absolute right-3 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-opacity duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            visible ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {current ? (
          <InvestorDetailPanel
            id={current.id}
            showEdit={false}
            compact
            onSelectStartup={() => { /* startup-in-investor drilling not supported here */ }}
            onSelectInvestor={() => { /* investor-in-investor drilling not supported here */ }}
          />
        ) : (
          modalId && (
            <StartupDetailPanel
              id={modalId}
              showEdit={false}
              compact
              onClose={onClose}
              returnSearch={returnSearch}
              onSelectInvestor={(iid) => push({ kind: "investor", id: iid })}
            />
          )
        )}
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
