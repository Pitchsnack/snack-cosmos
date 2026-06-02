import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Sparkles, RefreshCw, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealTable } from "@/components/deals/deal-table";
import { DealPipeline } from "@/components/deals/deal-pipeline";
import { useDeals } from "@/hooks/use-deals";
import { usePermissions } from "@/hooks/use-session-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({ meta: [{ title: "Deals — SnackPortal2" }] }),
  component: DealsPage,
});

function DealsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch } = useDeals();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((d) =>
      d.deal_name.toLowerCase().includes(needle) ||
      (d.startup_name ?? "").toLowerCase().includes(needle) ||
      (d.investor_name ?? "").toLowerCase().includes(needle) ||
      (d.stage ?? "").toLowerCase().includes(needle) ||
      (d.tenant_name ?? "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (!has("deals.read")) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        You don't have permission to view deals.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Deal Pipeline
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every deal links one startup to one investor with one Owning Agent and one Owning AI Agent.
          </p>
        </div>
        {has("deals.write") && (
          <Button onClick={() => navigate({ to: "/deals/new" })} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" /> New deal
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by deal, startup, investor, stage, tenant…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table"><List className="mr-1.5 h-4 w-4" /> Table</TabsTrigger>
          <TabsTrigger value="pipeline"><LayoutGrid className="mr-1.5 h-4 w-4" /> Pipeline</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="pt-4">
          <DealTable rows={rows} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="pipeline" className="pt-4">
          {isLoading ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <DealPipeline rows={rows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
