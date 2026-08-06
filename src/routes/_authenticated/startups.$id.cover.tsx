import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { StartupCoverPage } from "@/components/startups/startup-cover-page";
import { PermissionGuard } from "@/components/permission-guard";
import { StartupNotFound } from "@/components/startups/startup-not-found";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/startups/$id/cover")({
  head: () => ({
    meta: [
      { title: "Startup Cover Page — SnackPortal2" },
      {
        name: "description",
        content:
          "Polished PitchSnack cover page presenting an existing startup profile from the Startup Directory.",
      },
      { property: "og:title", content: "Startup Cover Page — SnackPortal2" },
      {
        property: "og:description",
        content: "PitchSnack cover page view of a startup profile in the Startup Directory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DirectoryCoverPage,
});

function DirectoryCoverPage() {
  const { id } = Route.useParams();

  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <div className="space-y-4">
        <Link
          to="/startups/$id"
          params={{ id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to startup
        </Link>
        {isUuid(id) ? (
          <StartupCoverPage id={id} workspace="startups" canEditBackground={false} />
        ) : (
          <StartupNotFound reason="invalid" />
        )}
      </div>
    </PermissionGuard>
  );
}
