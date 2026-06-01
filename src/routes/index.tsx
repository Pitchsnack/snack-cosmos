import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tenants — SnackPortal2 Control" },
      {
        name: "description",
        content: "Create, edit, and administer SnackPortal2 tenants.",
      },
    ],
  }),
  component: TenantsPage,
});

function statusVariant(status: string) {
  switch (status) {
    case "Active":
      return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    case "Draft":
      return "bg-muted text-muted-foreground border-border";
    case "Suspended":
    case "Archived":
      return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
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

  const { data, isLoading, error } = useQuery({
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
    if (!q) return data;
    return data.filter(
      (t) =>
        t.tenant_name.toLowerCase().includes(q) ||
        t.tenant_code.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q),
    );
  }, [data, search]);

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
          <h1 className="text-3xl font-semibold tracking-tight">Tenants</h1>
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
        >
          <Plus className="mr-2 h-4 w-4" />
          New tenant
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="success" />
        <StatCard label="Draft" value={counts.draft} />
        <StatCard label="Deleted" value={counts.deleted} tone="destructive" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or status…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
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
                      {search ? "No tenants match your search." : "No tenants yet. Create the first one."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
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
      ? "text-[color:var(--success)]"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
