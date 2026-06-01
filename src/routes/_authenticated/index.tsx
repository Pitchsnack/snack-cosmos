import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Building2,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TenantFormDialog,
  type TenantRow,
} from "@/components/tenant-form-dialog";
import { logAudit } from "@/lib/tenant-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Tenants — SnackPortal2" },
      {
        name: "description",
        content: "Create, edit, and administer SnackPortal2 tenants.",
      },
    ],
  }),
  component: TenantsPage,
});

type SortKey = "tenant_name" | "tenant_code" | "status" | "created_at";
const PAGE_SIZE = 10;

function statusVariant(status: string) {
  switch (status) {
    case "Active":
      return "bg-success/15 text-success border-success/30";
    case "Draft":
      return "bg-muted text-muted-foreground border-border";
    case "Suspended":
    case "Archived":
      return "bg-warning/20 text-warning-foreground border-warning/40";
    case "Deleted":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TenantRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["tenants", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, tenant_code, tenant_name, status, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TenantRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const base = !q
      ? data
      : data.filter(
          (t) =>
            t.tenant_name.toLowerCase().includes(q) ||
            t.tenant_code.toLowerCase().includes(q) ||
            t.status.toLowerCase().includes(q),
        );
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey] as string;
      const bv = b[sortKey] as string;
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const old = { ...deleting };
    const { error } = await supabase
      .from("tenants")
      .update({ status: "Deleted" })
      .eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      tenantId: deleting.id,
      entityType: "tenant",
      entityId: deleting.id,
      action: "DELETE",
      oldValue: old,
      newValue: { ...old, status: "Deleted" },
    });
    toast.success(`Tenant "${deleting.tenant_name}" archived (soft delete)`);
    setDeleting(null);
    refresh();
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["tenants"] });
  }

  const counts = useMemo(() => {
    const c = { total: 0, active: 0, draft: 0, deleted: 0 };
    for (const t of data ?? []) {
      c.total++;
      if (t.status === "Active") c.active++;
      else if (t.status === "Draft") c.draft++;
      else if (t.status === "Deleted") c.deleted++;
    }
    return c;
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer organizations on the SnackPortal2 platform. Tenant codes are
            generated automatically from the name.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New tenant
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="success" />
        <StatCard label="Draft" value={counts.draft} />
        <StatCard label="Deleted" value={counts.deleted} tone="destructive" />
      </div>

      <div className="rounded-[var(--radius)] border border-border bg-card shadow-card">
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md bg-muted/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code, or status…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortHead label="Tenant" k="tenant_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortHead label="Code" k="tenant_code" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortHead label="Created" k="created_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading tenants…
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  Failed to load: {(error as Error).message}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8 opacity-60" />
                    <p className="text-sm">
                      {search
                        ? "No tenants match your search."
                        : "No tenants yet. Create the first one."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{t.tenant_name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {t.tenant_code}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusVariant(t.status)}>
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(t);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(t)}
                      disabled={t.status === "Deleted"}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <TenantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={editing}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              The tenant <strong>{deleting?.tenant_name}</strong> will be marked as
              Deleted (soft delete per PRD 1 §7). Records remain in the database
              and can be restored by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ArrowUpDown
          className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")}
        />
        {active && <span className="sr-only">{sortDir}</span>}
      </button>
    </TableHead>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-tight", color)}>
        {value}
      </div>
    </div>
  );
}
