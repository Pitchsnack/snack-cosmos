import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Share2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission-guard";
import { SharedDealTable } from "@/components/deals/shared-deal-table";
import { useSharedDeals } from "@/hooks/use-shared-deals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shared-deals")({
  head: () => ({ meta: [{ title: "Shared Deals — SnackPortal2" }] }),
  component: SharedDealsPage,
});

function SharedDealsPage() {
  return (
    <PermissionGuard permission="deals.share.read" message="You don't have permission to view shared deals.">
      <SharedDealsPageInner />
    </PermissionGuard>
  );
}

function SharedDealsPageInner() {
  const { data, isLoading, isFetching, refetch } = useSharedDeals();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter((r) =>
      r.dealName.toLowerCase().includes(n)
      || (r.startupName ?? "").toLowerCase().includes(n)
      || (r.investorName ?? "").toLowerCase().includes(n)
      || (r.originTenantName ?? "").toLowerCase().includes(n)
      || (r.targetTenantName ?? "").toLowerCase().includes(n),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" /> Collaboration Network
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Shared Deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deals shared with your workspace — and deals you have shared with others. Ownership and origin tenant remain unchanged.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by deal, startup, investor, tenant…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <SharedDealTable rows={rows} isLoading={isLoading} />
    </div>
  );
}
