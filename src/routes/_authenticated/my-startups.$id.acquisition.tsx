import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PermissionGuard } from "@/components/permission-guard";
import { StartupNotFound } from "@/components/startups/startup-not-found";
import { AcquisitionStrategyPage } from "@/components/acquisition/acquisition-strategy-page";
import { useStartup } from "@/hooks/use-startup";
import { usePermissions } from "@/hooks/use-session-context";
import type { StartupDetail } from "@/lib/startups.functions";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/my-startups/$id/acquisition")({
  validateSearch: z.object({
    tab: z
      .enum([
        "overview",
        "startup-info",
        "targets",
        "competitors",
        "requirements",
        "insights",
      ])
      .optional(),
    // Linked startup shown in the information-panel overlay.
    panel: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Acquisition Strategy — SnackPortal2" },
      {
        name: "description",
        content:
          "Private acquisition strategy workspace: target companies, competitor references and acquisition requirements for a startup you own.",
      },
      { property: "og:title", content: "Acquisition Strategy — SnackPortal2" },
      {
        property: "og:description",
        content: "Define companies to acquire and criteria for discovering ideal acquisition targets.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcquisitionStrategyRoute,
});

function AcquisitionStrategyRoute() {
  const { id } = Route.useParams();
  const { tab, panel } = Route.useSearch();
  const validId = isUuid(id);
  const { data, isLoading, error } = useStartup(validId ? id : undefined);
  const { has, isControl } = usePermissions();
  const canEdit = isControl || has("startups.write");

  return (
    <PermissionGuard permission="startups.read" message="You don't have permission to view startups.">
      {!validId ? (
        <StartupNotFound reason="invalid" workspace="my-startups" />
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error || !data ? (
        <StartupNotFound reason="missing" workspace="my-startups" />
      ) : (
        <AcquisitionStrategyPage
          startup={data as unknown as StartupDetail}
          tab={tab ?? "overview"}
          canEdit={canEdit}
          panelStartupId={panel && isUuid(panel) ? panel : null}
        />
      )}
    </PermissionGuard>
  );
}
