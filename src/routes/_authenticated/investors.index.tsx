import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Plus, Search, Briefcase, RefreshCw, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvestorCard } from "@/components/investors/investor-card";
import { InvestorListItem } from "@/components/investors/investor-list-item";
import { InvestorDetailPanel, InvestorDetailEmpty } from "@/components/investors/investor-detail-panel";
import { ViewToggle } from "@/components/shared/view-toggle";
import { useInvestors } from "@/hooks/use-investors";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { cn } from "@/lib/utils";

const VIEW = ["grid","split"] as const;

const searchSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  country: z.string().optional(),
  view: z.enum(VIEW).optional(),
  selected: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/investors/")({
  head: () => ({ meta: [{ title: "Investors — SnackPortal2" }] }),
  validateSearch: searchSchema,
  component: InvestorsPage,
});

function InvestorsPage() {
  return (
    <PermissionGuard permission="investors.read" message="You don't have permission to view investors.">
      <InvestorsPageInner />
    </PermissionGuard>
  );
}

function InvestorsPageInner() {
  const { has } = usePermissions();
  const navigate = useNavigate({ from: "/investors" });
  const s = Route.useSearch();
  const view = s.view ?? "grid";
  const selected = s.selected;

  const { data, isLoading, isFetching, refetch } = useInvestors({
    search: s.q, type: s.type, country: s.country,
  });

  const rows = data ?? [];

  const types = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.investor_type) set.add(r.investor_type); });
    return Array.from(set).sort();
  }, [rows]);

  const update = (patch: Partial<typeof s>) =>
    navigate({ search: (prev: typeof s) => ({ ...prev, ...patch }) });

  const hasFilter = !!(s.q || s.type || s.country);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Investor Directory
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Investors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length > 0 ? `${rows.length} investor${rows.length === 1 ? "" : "s"}` : "Every investor has one Owning Agent and one Owning AI Agent."}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="flex flex-1 min-w-[16rem] items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={s.q ?? ""}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder="Search name, description, type, country…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Input
          value={s.type ?? ""}
          onChange={(e) => update({ type: e.target.value || undefined })}
          placeholder="Type"
          list="investor-types"
          className="h-9 w-36"
        />
        <datalist id="investor-types">
          {types.map((t) => <option key={t} value={t} />)}
        </datalist>
        <Input
          value={s.country ?? ""}
          onChange={(e) => update({ country: e.target.value || undefined })}
          placeholder="Country"
          className="h-9 w-32"
        />
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ search: (p: typeof s) => ({ view: p.view }) })} className="gap-1">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Briefcase className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No investors match your filters.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => <InvestorCard key={r.id} i={r} />)}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
            {rows.map((r) => (
              <InvestorListItem
                key={r.id}
                i={r}
                selected={selected === r.id}
                onSelect={() => navigate({ search: (p: typeof s) => ({ ...p, selected: r.id }) })}
              />
            ))}
          </div>
          <div className="min-w-0">
            {selected ? <InvestorDetailPanel id={selected} showEdit /> : <InvestorDetailEmpty />}
          </div>
        </div>
      )}
    </div>
  );
}
