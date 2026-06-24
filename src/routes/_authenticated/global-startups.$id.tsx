import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PermissionGuard } from "@/components/permission-guard";
import {
  GlobalStartupForm,
  type GlobalStartupFormValues,
} from "@/components/global-startups/global-startup-form";
import {
  useGlobalStartup,
  useGlobalStartupImports,
} from "@/hooks/use-global-startup";
import { updateGlobalStartup } from "@/lib/api-gateway/global-startups";

export const Route = createFileRoute("/_authenticated/global-startups/$id")({
  head: () => ({ meta: [{ title: "Global Startup — SnackPortal2" }] }),
  component: GlobalStartupDetailPage,
});

function GlobalStartupDetailPage() {
  return (
    <PermissionGuard
      permission="global_startups.write"
      message="Only Control admins can curate the Global Startups registry."
    >
      <Inner />
    </PermissionGuard>
  );
}

function Inner() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useGlobalStartup(id);
  const importsQ = useGlobalStartupImports(id);
  const qc = useQueryClient();
  const updateFn = useServerFn(updateGlobalStartup);

  const updateM = useMutation({
    mutationFn: (v: GlobalStartupFormValues) =>
      updateFn({ data: { globalId: id, ...v } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["global-startup", id] });
      qc.invalidateQueries({ queryKey: ["global-startups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data)
    return (
      <div className="text-sm text-destructive">
        Failed to load: {(error as Error)?.message ?? "Not found"}
      </div>
    );

  return (
    <div className="space-y-6">
      <Link
        to="/global-startups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Global Startups
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Global Catalogue
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{data.status}</Badge>
            {data.sector && <Badge variant="outline">{data.sector}</Badge>}
            {data.stage && <Badge variant="outline">{data.stage}</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="imports">
            Import history{importsQ.data ? ` (${importsQ.data.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="pt-4">
          <div className="rounded-lg border border-border bg-card p-6 shadow-card">
            <GlobalStartupForm
              initial={data}
              onSubmit={(v) => updateM.mutate(v)}
              submitting={updateM.isPending}
              submitLabel="Save changes"
            />
          </div>
        </TabsContent>

        <TabsContent value="imports" className="pt-4">
          {importsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !importsQ.data || importsQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenants have imported this global startup yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Tenant</th>
                    <th className="px-4 py-2.5 font-medium">Tenant Startup ID</th>
                    <th className="px-4 py-2.5 font-medium">Imported by</th>
                    <th className="px-4 py-2.5 font-medium">Imported at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {importsQ.data.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.tenant_id}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {r.tenant_startup_id}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.imported_by}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {new Date(r.imported_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Source: <code>global_startup_imports</code> ledger. Never joined to
            tenant startup rows.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link to="/global-startups">Done</Link>
        </Button>
      </div>
    </div>
  );
}
