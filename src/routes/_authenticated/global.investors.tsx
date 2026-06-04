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
import { useGlobalInvestors } from "@/hooks/use-global-directory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/global/investors")({
  head: () => ({ meta: [{ title: "Global Investors — SnackPortal2" }] }),
  component: GlobalInvestorsPage,
});

function GlobalInvestorsPage() {
  return (
    <PermissionGuard
      anyOf={["investors.read"]}
      allowControl
      message="Global directories are restricted to CONTROL users."
    >
      <Inner />
    </PermissionGuard>
  );
}

function Inner() {
  const { data, isLoading, isFetching, refetch } = useGlobalInvestors();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const all = data ?? [];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter((r) =>
      [r.name, r.country, r.investorType, r.originTenantName]
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
            Global Investors
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Importing an investor creates an independent tenant record. No sync,
            no propagation — Global ≠ Tenant.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, country, type, origin tenant…"
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
              <TableHead>Type</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Origin tenant</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Loading global directory…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No global investors available.
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
                  <TableCell className="text-sm text-muted-foreground">{r.investorType || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.ticketSize || "—"}</TableCell>
                  <TableCell className="text-sm">{r.originTenantName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <ImportFromGlobalDialog
                      entity="investor"
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
