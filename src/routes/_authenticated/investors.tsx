import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvestorTable } from "@/components/investors/investor-table";
import { useInvestors } from "@/hooks/use-investors";
import { usePermissions } from "@/hooks/use-session-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/investors")({
  head: () => ({ meta: [{ title: "Investors — SnackPortal2" }] }),
  component: InvestorsPage,
});

function InvestorsPage() {
  const { has } = usePermissions();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch } = useInvestors();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((s) =>
      s.investor_name.toLowerCase().includes(needle) ||
      (s.country ?? "").toLowerCase().includes(needle) ||
      (s.investor_type ?? "").toLowerCase().includes(needle) ||
      (s.tenant_name ?? "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (!has("investors.read")) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        You don't have permission to view investors.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Investor Directory
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Investors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every investor has one Owning Agent and one Owning AI Agent.
          </p>
        </div>
        {has("investors.write") && (
          <Button onClick={() => navigate({ to: "/investors/new" })} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" /> New investor
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, country, type, tenant…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <InvestorTable rows={rows} isLoading={isLoading} />
    </div>
  );
}
