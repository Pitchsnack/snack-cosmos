import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Globe2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PermissionGuard } from "@/components/permission-guard";
import { OriginBadge } from "@/components/global/origin-badge";
import { ImportFromGlobalDialog } from "@/components/global/import-from-global-dialog";
import { useGlobalStartups } from "@/hooks/use-global-directory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/global/startups")({
  head: () => ({ meta: [{ title: "Global Startups — SnackPortal2" }] }),
  component: GlobalStartupsPage,
});

function GlobalStartupsPage() {
  return (
    <PermissionGuard
      anyOf={["startups.read"]}
      allowControl
      message="Global directories are restricted to CONTROL users."
    >
      <Inner />
    </PermissionGuard>
  );
}

function Inner() {
  const { data, isLoading, isFetching, refetch } = useGlobalStartups();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter((r) =>
      [r.name, r.country, r.industry, r.originTenantName]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(n)),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" /> Control · Global Directory
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Global Startups
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The Control-side discovery pool. Importing a row creates an{" "}
            <strong>independent tenant record</strong>. Global ≠ Tenant: edits
            never propagate either way.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, country, industry, origin tenant…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Name</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Origin tenant</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Loading global directory…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No global startups available.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    {r.name}
                    {r.legalName && (
                      <div className="text-xs text-muted-foreground">{r.legalName}</div>
                    )}
                  </TableCell>
                  <TableCell><OriginBadge origin="global" /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.country || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.industry || "—"}</TableCell>
                  <TableCell className="text-sm">{r.originTenantName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <ImportFromGlobalDialog
                      entity="startup"
                      sourceGlobalId={r.id}
                      sourceName={r.name}
                      originTenantName={r.originTenantName}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
