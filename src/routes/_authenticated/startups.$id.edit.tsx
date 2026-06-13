import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";
import { useStartup } from "@/hooks/use-startup";
import type { StartupDetail } from "@/lib/startups.functions";

export const Route = createFileRoute("/_authenticated/startups/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Startup — SnackPortal2" }] }),
  component: EditStartupPage,
});

function EditStartupPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useStartup(id);

  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to edit startups.">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to="/startups/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to startup
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit startup</h1>
        </div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}
        {data && <StartupForm startup={data as unknown as StartupDetail} />}
      </div>
    </PermissionGuard>
  );
}
