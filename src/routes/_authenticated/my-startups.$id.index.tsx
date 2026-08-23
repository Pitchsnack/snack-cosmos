import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Pencil, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { PermissionGuard } from "@/components/permission-guard";
import { StartupNotFound } from "@/components/startups/startup-not-found";
import { usePermissions } from "@/hooks/use-session-context";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/my-startups/$id/")({
  head: () => ({
    meta: [
      { title: "My Startup Details — SnackPortal2" },
      {
        name: "description",
        content: "Private founder workspace view of a startup you own or manage.",
      },
    ],
  }),
  component: MyStartupDetailPage,
});

function MyStartupDetailPage() {
  const { id } = Route.useParams();
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");

  if (!isUuid(id)) {
    return (
      <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
        <StartupNotFound reason="invalid" workspace="my-startups" />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> MY WORKSPACE
            </div>
            <Link
              to="/my-startups"
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to My Startups
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/my-startups/$id/acquisition" params={{ id }}>
                <Target className="mr-1 h-3.5 w-3.5" /> Acquisition Strategy
              </Link>
            </Button>
            {canManage && (
              <Button asChild size="sm" variant="outline">
                <Link to="/my-startups/$id/edit" params={{ id }}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit my startup
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <StartupDetailPanel id={id} showEdit={false} showPublication workspace="my-startups" />
        </div>
      </div>
    </PermissionGuard>
  );
}
