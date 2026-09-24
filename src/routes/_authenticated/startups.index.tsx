import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Rocket, RefreshCw, X, Star, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
import { EntryProfileTabs, type EntryTab } from "@/components/hidden-profile/entry-tabs";
import { HiddenCard } from "@/components/hidden-profile/hidden-card";
import { HiddenStatusChip } from "@/components/hidden-profile/bits";
import { useHiddenProfiles, useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import { hiddenStatusOf, type HiddenStatus } from "@/lib/hidden-profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvestorDetailPanel } from "@/components/investors/investor-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import { useStartups } from "@/hooks/use-startups";
import { useFavoriteStartups } from "@/hooks/use-favorites";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { isPublicationPreview, listPreviewPublishedRefs } from "@/lib/publication";
import { usePreviewPublicationVersion } from "@/hooks/use-publication";
import { cn } from "@/lib/utils";
import { SECTORS, BUSINESS_MODELS, businessModelLabel } from "@/lib/sectors";


const SORT = ["updated_desc","created_desc","name_asc","name_desc"] as const;
const VIEW = ["grid","split","list"] as const;
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Other"];
const COMPANY_TYPES = ["SaaS","FinTech","Marketplace","AI","Hardware","Consumer","Other"];


const searchSchema = z.object({
  q: z.string().optional(),
  stage: z.string().optional(),
  industry: z.string().optional(),
  sector: z.string().optional(),
  bmodel: z.string().optional(),
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
  cards: z.enum(["full", "hidden"]).optional(),
  hp: z.enum(["all", "live", "draft", "none"]).optional(),
  tab: z.enum(["full", "hidden", "compare"]).optional(),
  edit: z.coerce.boolean().optional(),
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
  // Split is the default; the choice persists across refresh/reopen via
  // localStorage. An explicit ?view= param (shared link) always wins.
  const { view, persist: persistView } = usePersistentView("sp2-startups-view", s.view);
  const selected = s.selected;
  const favOnly = !!s.fav;
  // The information panel is URL-addressable so returning from Edit restores it
  // over the still-rendered Startup Directory cards.
  const [modalId, setModalId] = useState<string | null>(s.panel ?? null);
  useEffect(() => {
    if (s.panel) setModalId(s.panel);
  }, [s.panel]);
  const cardsMode = s.cards ?? "full";
  const hpFilter = s.hp ?? "all";
  const tab: EntryTab = s.tab ?? (cardsMode === "hidden" ? "hidden" : "full");
  const editing = !!s.edit;
  const isMobile = useIsMobile();
  const openerRef = useRef<HTMLElement | null>(null);
  const setTab = (t: EntryTab) => navigate({ search: (p: typeof s) => ({ ...p, tab: t }), replace: true });
  const setEditing = (v: boolean) => navigate({ search: (p: typeof s) => ({ ...p, edit: v || undefined }), replace: true });
  const closeStartup = () => {
    setModalId(null);
    navigate({ search: (prev: typeof s) => ({ ...prev, panel: undefined, edit: undefined }), replace: true });
  };
  const openStartup = (id: string, opts?: { tab?: EntryTab; edit?: boolean }) => {
    openerRef.current = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
    setModalId(id);
    navigate({
      search: (prev: typeof s) => ({
        ...prev,
        panel: id,
        tab: opts?.tab ?? (cardsMode === "hidden" ? "hidden" : "full"),
        edit: opts?.edit || undefined,
      }),
      replace: true,
    });
  };
  const { byStartup } = useHiddenProfiles();
  const hpActions = useHiddenProfileActions();
  const createHidden = async (id: string, inSplit: boolean) => {
    if (!byStartup.get(id)) {
      try { await hpActions.create.mutateAsync({ startupId: id }); } catch { return; }
    }
    if (inSplit && !isMobile) navigate({ search: (p: typeof s) => ({ ...p, selected: id, tab: "hidden", edit: true }) });
    else openStartup(id, { tab: "hidden", edit: true });
  };

  const { ids: favIds } = useFavoriteStartups();


  const pageSize = favOnly ? 100 : view === "split" ? 50 : view === "list" ? 25 : 24;

  // Preview-only, opt-in simulation. Never authoritative for the real directory:
  // it is off by default, available only in preview mode, and never persists.
  const previewVersion = usePreviewPublicationVersion();
  // Session-scoped preview publications are the ONLY way a Private founder-owned
  // startup may enter this list, and only in explicitly labelled preview mode.
  const allowPrivateRefs = useMemo(() => {
    void previewVersion;
    return isPublicationPreview ? listPreviewPublishedRefs() : [];
  }, [previewVersion]);

  const { data, isLoading, isFetching, refetch } = useStartups({
    search: s.q, stage: s.stage, industry: s.industry, headquarters: s.hq,
    sector: s.sector, businessModel: s.bmodel,
    companyType: s.ct, productTag: s.ptag, marketTag: s.mtag,
    sort, page: favOnly ? 1 : page, pageSize,
    // Directory read model: Private records are excluded by the query itself,
    // not hidden after rendering.
    scope: "directory",
    allowPrivateRefs,
  });

  const rawItems = data && "items" in data ? data.items : [];
  const statusOf = (it: (typeof rawItems)[number]): HiddenStatus => hiddenStatusOf(byStartup.get(it.id), it.company_type);
  const hpCounts = useMemo(() => {
    const c = { all: rawItems.length, live: 0, draft: 0, none: 0 };
    for (const it of rawItems) {
      const st = hiddenStatusOf(byStartup.get(it.id), it.company_type);
      if (st === "live" || st === "live_edited") c.live++;
      else if (st === "draft") c.draft++;
      else c.none++;
    }
    return c;
  }, [rawItems, byStartup]);
  const baseItems = useMemo(() => {
    if (hpFilter === "all") return rawItems;
    return rawItems.filter((it) => {
      const st = hiddenStatusOf(byStartup.get(it.id), it.company_type);
      if (hpFilter === "live") return st === "live" || st === "live_edited";
      if (hpFilter === "draft") return st === "draft";
      return st === "none" || st === "na";
    });
  }, [rawItems, hpFilter, byStartup]);
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

  const hasFilter = !!(s.q || s.stage || s.industry || s.sector || s.bmodel || s.hq || s.ct || s.ptag || s.mtag);

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
            onChange={(v) => {
              persistView(v);
              navigate({ search: (p: typeof s) => ({ ...p, view: v }) });
            }}
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
        <FilterSelect label="Sector" value={s.sector} options={SECTORS} onChange={(v) => update({ sector: v })} />
        <FilterSelect
          label="Business model"
          value={s.bmodel}
          options={BUSINESS_MODELS.map((b) => b.value)}
          optionLabel={(v) => businessModelLabel(v) ?? v}
          onChange={(v) => update({ bmodel: v })}
        />
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-md bg-muted/60 p-1 text-xs">
          <span className="px-2 text-muted-foreground">Hidden profile:</span>
          {(["all", "live", "draft", "none"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={hpFilter === k}
              onClick={() => navigate({ search: (p: typeof s) => ({ ...p, hp: k === "all" ? undefined : k, page: 1 }) })}
              className={cn("rounded px-2 py-1 font-medium", hpFilter === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {k === "all" ? "All" : k === "live" ? "Live" : k === "draft" ? "Drafts" : "None"} <span className="opacity-60">{hpCounts[k]}</span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {cardsMode === "hidden" && view !== "list"
            ? "What buyers see in SME Takeover. Only Admin sees the Full profile row."
            : "Live hidden profiles are what buyers see in SME Takeover before the NDA."}
        </span>
        {view !== "list" && (
          <div className="ml-auto inline-flex items-center gap-1 rounded-md bg-muted/60 p-1 text-xs">
            <span className="px-2 text-muted-foreground">Cards:</span>
            {(["full", "hidden"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={cardsMode === k}
                onClick={() => navigate({ search: (p: typeof s) => ({ ...p, cards: k === "full" ? undefined : k, tab: k === "hidden" ? "hidden" : "full", edit: undefined }) })}
                className={cn("inline-flex items-center gap-1 rounded px-2 py-1 font-medium", cardsMode === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {k === "full" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {k === "full" ? "Full" : "Hidden"}
              </button>
            ))}
          </div>
        )}
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
          {items.map((it) =>
            cardsMode === "hidden" ? (
              <HiddenCard
                key={it.id}
                s={it}
                row={byStartup.get(it.id)}
                variant="grid"
                onOpen={() => openStartup(it.id, { tab: "hidden" })}
                onProfiles={() => openStartup(it.id, { tab: "hidden" })}
                onCreate={() => void createHidden(it.id, false)}
              />
            ) : (
              <div key={it.id} className="space-y-1.5">
                <StartupCard s={it} onClick={() => openStartup(it.id, { tab: "full" })} compact={favOnly} />
                <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                  <span className="shrink-0">Hidden profile:</span>
                  <HiddenStatusChip status={statusOf(it)} codeName={byStartup.get(it.id)?.code_name} />
                  <button type="button" onClick={() => openStartup(it.id, { tab: "full" })} className="ml-auto shrink-0 rounded-md border border-border px-2 py-0.5 font-medium text-foreground hover:bg-muted">Profiles</button>
                </div>
              </div>
            ),
          )}
        </div>
      ) : view === "list" ? (
        favOnly ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <FavoriteListHeader />
            {items.map((it) => (
              <FavoriteListRow key={it.id} s={it} onSelect={() => openStartup(it.id, { tab: "full" })} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><StartupRow s={it} onSelect={() => openStartup(it.id, { tab: "full" })} /></div>
                <div className="w-44 shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hidden profile</div>
                  <HiddenStatusChip status={statusOf(it)} codeName={byStartup.get(it.id)?.code_name} />
                </div>
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
              : items.map((it) => {
                  const pick = () =>
                    isMobile
                      ? openStartup(it.id)
                      : navigate({ search: (p: typeof s) => ({ ...p, selected: it.id, edit: undefined }) });
                  return cardsMode === "hidden" ? (
                    <HiddenCard
                      key={it.id}
                      s={it}
                      row={byStartup.get(it.id)}
                      variant="split"
                      selected={selected === it.id}
                      onOpen={pick}
                      onCreate={() => void createHidden(it.id, true)}
                    />
                  ) : (
                    <div key={it.id}>
                      <StartupListItem s={it} selected={selected === it.id} onSelect={pick} />
                      <div className="flex items-center gap-2 px-2 pt-1 text-[11px] text-muted-foreground">
                        Hidden profile: <HiddenStatusChip status={statusOf(it)} codeName={byStartup.get(it.id)?.code_name} />
                      </div>
                    </div>
                  );
                })}
          </div>
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4">
            {selected ? (
              <EntryProfileTabs id={selected} tab={tab} onTabChange={setTab} editing={editing} onEditingChange={setEditing} />
            ) : (
              <StartupDetailEmpty />
            )}
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
          onCloseAutoFocus={(e) => {
            if (openerRef.current) {
              e.preventDefault();
              openerRef.current.focus();
            }
          }}
          className={cn(
            "[&>button]:hidden",
            "p-0 gap-0 flex flex-col overflow-hidden",
            "sm:max-w-[820px] sm:max-h-[88vh] sm:rounded-2xl",
            "max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none",
          )}
        >
          <StartupPanelModalBody
            modalId={modalId}
            onClose={closeStartup}
            returnSearch={{ ...s, panel: undefined }}
            tab={tab}
            onTabChange={setTab}
            editing={editing}
            onEditingChange={setEditing}
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
  tab,
  onTabChange,
  editing,
  onEditingChange,
}: {
  modalId: string | null;
  onClose: () => void;
  returnSearch: Omit<z.infer<typeof searchSchema>, "panel"> & { panel?: undefined };
  tab: EntryTab;
  onTabChange: (t: EntryTab) => void;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;
  type StackEntry = { kind: "investor" | "startup"; id: string };
  const [stack, setStack] = useState<StackEntry[]>([]);

  // Reset the drill-down stack whenever the root startup changes.
  useEffect(() => {
    setStack([]);
  }, [modalId]);

  const current = stack[stack.length - 1];
  const push = (entry: StackEntry) => setStack((prev) => [...prev, entry]);

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
          current.kind === "investor" ? (
            <InvestorDetailPanel
              id={current.id}
              showEdit={false}
              compact
              onSelectStartup={(sid) => push({ kind: "startup", id: sid })}
              onSelectInvestor={(iid) => push({ kind: "investor", id: iid })}
            />
          ) : (
            <StartupDetailPanel
              id={current.id}
              showEdit={false}
              compact
              onSelectInvestor={(iid) => push({ kind: "investor", id: iid })}
            />
          )
        ) : (
          modalId && (
            <EntryProfileTabs
              tab={tab}
              onTabChange={onTabChange}
              editing={editing}
              onEditingChange={onEditingChange}
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

function FilterSelect({ label, value, options, onChange, optionLabel }: { label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void; optionLabel?: (v: string) => string }) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className="h-9 w-36"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{optionLabel ? optionLabel(o) : o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
