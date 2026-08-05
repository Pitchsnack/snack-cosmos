import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Share2, ArrowRight, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStartups } from "@/hooks/use-startups";
import { PermissionGuard } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/share-coverpage")({
  head: () => ({
    meta: [
      { title: "Share Coverpage — SnackPortal2" },
      { name: "description", content: "View and share your startup's public cover page." },
    ],
  }),
  component: ShareCoverpageRoute,
});

function ShareCoverpageRoute() {
  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      <ShareCoverpageInner />
    </PermissionGuard>
  );
}

function ShareCoverpageInner() {
  const navigate = useNavigate({ from: "/share-coverpage" });
  const { data, isLoading } = useStartups({ scope: "workspace", pageSize: 1 });

  const firstStartup = data?.items[0];

  useEffect(() => {
    if (isLoading) return;
    if (firstStartup?.id) {
      navigate({ to: "/share/startup/$id", params: { id: firstStartup.id } });
    }
  }, [isLoading, firstStartup, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Finding your startup…
      </div>
    );
  }

  if (!firstStartup) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-flex mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Share2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">No startup to share yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a startup in My Startups first, then come back here to view its public cover page.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/my-startups">
                <Building2 className="mr-2 h-4 w-4" /> My Startups
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect is handled by useEffect; this is a brief transitional state.
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Opening your cover page…
      <ArrowRight className="ml-2 h-4 w-4" />
    </div>
  );
}
