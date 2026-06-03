import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Rocket, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StartupTable } from "@/components/startups/startup-table";
import { useStartups } from "@/hooks/use-startups";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/startups")({
  head: () => ({ meta: [{ title: "Startups — SnackPortal2" }] }),
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
  const navigate = useNavigate();
  const { data, isLoading, isFetching, refetch } = useStartups();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((s) =>
      s.startup_name.toLowerCase().includes(needle) ||
      (s.country ?? "").toLowerCase().includes(needle) ||
      (s.industry ?? "").toLowerCase().includes(needle) ||
      (s.tenant_name ?? "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Rocket className="h-3.5 w-3.5" /> Startup Directory
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Startups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every startup has one Owning Agent and one Owning AI Agent.
          </p>
        </div>
        {has("startups.write") && (
          <Button
            onClick={() => navigate({ to: "/startups/new" })}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="mr-2 h-4 w-4" /> New startup
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, country, industry, tenant…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <StartupTable rows={rows} isLoading={isLoading} />
    </div>
  );
}
