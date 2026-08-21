import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Briefcase, RefreshCw, X, Star, ArrowLeft } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { InvestorCard } from "@/components/investors/investor-card";
import { InvestorRow } from "@/components/investors/investor-row";
import { InvestorListItem } from "@/components/investors/investor-list-item";
import {
  InvestorDetailPanel,
  InvestorDetailEmpty,
} from "@/components/investors/investor-detail-panel";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { useInvestors } from "@/hooks/use-investors";
import { useFavoriteInvestors } from "@/hooks/use-favorites";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { cn } from "@/lib/utils";

const SORT = ["updated_desc", "created_desc", "name_asc", "name_desc"] as const;
const VIEW = ["grid", "split", "list"] as const;

export const investorDirectorySearchSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  country: z.string().optional(),
  sort: z.enum(SORT).optional(),
  view: z.enum(VIEW).optional(),
  selected: z.string().optional(),
  panel: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  fav: z.coerce.boolean().optional(),
});

export type InvestorDirectorySearch = z.infer<typeof investorDirectorySearchSchema>;


export const Route = createFileRoute("/_authenticated/investors/")({
  head: () => ({
    meta: [
      { title: "Investor Directory — SnackPortal2" },
      {
        name: "description",
        content:
          "Browse the SnackPortal2 investor directory: search, filter and connect with investors across stages, sectors and geographies.",
      },
      { property: "og:title", content: "Investor Directory — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Browse the SnackPortal2 investor directory: search, filter and connect with investors across stages, sectors and geographies.",
      },
    ],
  }),
  validateSearch: investorDirectorySearchSchema,
  component: InvestorsPage,
});

function InvestorsPage() {
  return (
    <PermissionGuard
      permission="investors.read"
      message="You don't have permission to view investors."
    >
      <InvestorsPageInner />
    </PermissionGuard>
  );
}

function InvestorsPageInner() {
  const { has } = usePermissions();
  const navigate = useNavigate({ from: "/investors" });
  const s = Route.useSearch();
  const page = s.page ?? 1;
  const sort = s.sort ?? "updated_desc";
  const view = s.view ?? "grid";
  const selected = s.selected;
  const favOnly = !!s.fav;
  const { ids: favIds } = useFavoriteInvestors();

  const pageSize = favOnly ? 100 : view === "split" ? 50 : view === "list" ? 25 : 24;

  const { data, isLoading, isFetching, refetch } = useInvestors({
    search: s.q,
    type: s.type,
    country: s.country,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const types = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.investor_type) set.add(r.investor_type);
    });
    return Array.from(set).sort();
  }, [rows]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.country) set.add(r.country);
    });
    return Array.from(set).sort();
  }, [rows]);

  const sorted = useMemo(() => {
    const list = favOnly ? rows.filter((r) => favIds.has(r.id)) : [...rows];
    const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return byName(a.investor_name, b.investor_name);
        case "name_desc":
          return byName(b.investor_name, a.investor_name);
        case "created_desc":
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        default:
          return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      }
    });
  }, [rows, favOnly, favIds, sort]);

  const total = sorted.length;
  const pageCount = favOnly ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const items = useMemo(
    () => (favOnly ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize)),
    [sorted, favOnly, page, pageSize],
  );

  const update = (patch: Partial<typeof s>) =>
    navigate({ search: (prev: typeof s) => ({ ...prev, ...patch, page: 1 }) });

  const hasFilter = !!(s.q || s.type || s.country);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Investor Directory
            {favOnly ? " · Favorites" : ""}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Venture Capital and Private Equity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {favOnly
              ? `${total} bookmarked investor${total === 1 ? "" : "s"}`
              : total > 0
                ? `${total} investor${total === 1 ? "" : "s"}`
                : "Browse and connect with investors."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={favOnly}
            aria-label={favOnly ? "Show all investors" : "Show only favorites"}
            title={favOnly ? "Show all investors" : "Show only favorites"}
            onClick={() =>
              navigate({
                search: (p: typeof s) => ({ ...p, fav: favOnly ? undefined : true, page: 1 }),
              })
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
          {has("investors.write") && (
            <Button
              onClick={() => navigate({ to: "/investors/new" })}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="mr-2 h-4 w-4" /> New investor
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={s.q ?? ""}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder="Search name, description, type, country…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <FilterSelect
          label="Type"
          value={s.type}
          options={types}
          onChange={(v) => update({ type: v })}
        />
        <FilterSelect
          label="Country"
          value={s.country}
          options={countries}
          onChange={(v) => update({ country: v })}
        />
        <Select
          value={sort}
          onValueChange={(v) =>
            navigate({ search: (prev: typeof s) => ({ ...prev, sort: v as (typeof SORT)[number] }) })
          }
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="created_desc">Recently created</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ search: (p: typeof s) => ({ view: p.view }) })}
            className="gap-1"
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-4 w-2/3" />
              </div>
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
          <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No investors match your filters.</p>
        </div>
      ) : view === "grid" ? (
        <div
          className={cn(
            "grid items-start gap-4",
            favOnly
              ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              : "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {items.map((it) => (
            <InvestorCard
              key={it.id}
              i={it}
              onClick={() => navigate({ search: (prev: typeof s) => ({ ...prev, panel: it.id }) })}
            />
          ))}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {items.map((it) => (
            <InvestorRow
              key={it.id}
              i={it}
              onSelect={() => navigate({ search: (prev: typeof s) => ({ ...prev, panel: it.id }) })}
            />
          ))}
        </div>
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
            {items.map((it) => (
              <InvestorListItem
                key={it.id}
                i={it}
                selected={selected === it.id}
                onSelect={() => navigate({ search: (p: typeof s) => ({ ...p, selected: it.id }) })}
              />
            ))}
          </div>
          <div className="min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4">
            {selected ? <InvestorDetailPanel id={selected} directorySearch={s} /> : <InvestorDetailEmpty />}
          </div>
        </div>
      )}

      {(view === "grid" || view === "list") && pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ search: (p: typeof s) => ({ ...p, page: page - 1 }) })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => navigate({ search: (p: typeof s) => ({ ...p, page: page + 1 }) })}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        open={!!s.panel && s.view !== "split"}
        onOpenChange={(o) =>
          !o && navigate({ search: (prev: typeof s) => ({ ...prev, panel: undefined }) })
        }
      >
        <DialogContent
          className={cn(
            "[&>button]:hidden",
            "flex flex-col gap-0 overflow-hidden p-0",
            "sm:w-[min(760px,calc(100vw-48px))] sm:max-w-[760px] sm:max-h-[85vh] sm:rounded-2xl",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
          )}
        >
          <InvestorPanelModalBody
            modalId={s.panel}
            onClose={() => navigate({ search: (prev: typeof s) => ({ ...prev, panel: undefined }) })}
            directorySearch={s}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvestorPanelModalBody({
  modalId,
  onClose,
  directorySearch,
}: {
  modalId: string | null | undefined;
  onClose: () => void;
  directorySearch?: InvestorDirectorySearch;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;
  const [stack, setStack] = useState<Array<{ kind: "investor" | "startup"; id: string }>>([]);

  // Reset the drill-down stack whenever the root investor changes.
  useEffect(() => {
    setStack([]);
  }, [modalId]);

  const current = stack[stack.length - 1];
  const push = (entry: { kind: "investor" | "startup"; id: string }) =>
    setStack((prev) => [...prev, entry]);

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative h-10 shrink-0">
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
        {current ? (
          current.kind === "startup" ? (
            <StartupDetailPanel id={current.id} showEdit={false} compact />
          ) : (
            <InvestorDetailPanel
              id={current.id}
              showEdit={false}
              compact
              onSelectStartup={(sid) => push({ kind: "startup", id: sid })}
              onSelectInvestor={(iid) => push({ kind: "investor", id: iid })}
            />
          )
        ) : (
          modalId && (
            <InvestorDetailPanel
              id={modalId}
              showEdit={false}
              compact
              onClose={onClose}
              directorySearch={directorySearch}
              onSelectStartup={(sid) => push({ kind: "startup", id: sid })}
              onSelectInvestor={(iid) => push({ kind: "investor", id: iid })}
            />
          )
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
      <SelectTrigger className="h-9 w-36">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
