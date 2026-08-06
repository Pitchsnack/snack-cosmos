import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2 } from "lucide-react";

import { StartupCoverPage } from "@/components/startups/startup-cover-page";
import { PermissionGuard } from "@/components/permission-guard";
import { StartupNotFound } from "@/components/startups/startup-not-found";
import { usePermissions } from "@/hooks/use-session-context";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/my-startups/$id/cover")({
  head: () => ({
    meta: [
      { title: "My Startup Cover Page — SnackPortal2" },
      {
        name: "description",
        content:
          "Preview and configure the PitchSnack cover page for a startup in your private My Startups workspace.",
      },
      { property: "og:title", content: "My Startup Cover Page — SnackPortal2" },
      {
        property: "og:description",
        content: "Configure the cover background and preview the shareable startup cover page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyStartupCoverPage,
});

function MyStartupCoverPage() {
  const { id } = Route.useParams();
  const { has, isControl } = usePermissions();
  const canEdit = isControl || has("startups.write");

  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> MY WORKSPACE
          </div>
          <Link
            to="/my-startups/$id"
            params={{ id }}
            className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to my startup
          </Link>
        </div>
        {isUuid(id) ? (
          <StartupCoverPage id={id} workspace="my-startups" canEditBackground={canEdit} />
        ) : (
          <StartupNotFound reason="invalid" workspace="my-startups" />
        )}
      </div>
    </PermissionGuard>
  );
}
