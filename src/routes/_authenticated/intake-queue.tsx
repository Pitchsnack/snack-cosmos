import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DEFAULT_INTAKE_PREVIEW_ENABLED } from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";
import { QueueTable } from "@/components/intake/queue-table";

export const Route = createFileRoute("/_authenticated/intake-queue")({
  head: () => ({
    meta: [
      { title: "Default Intake Queue — Preview" },
      {
        name: "description",
        content:
          "Preview queue of Startups and Investors awaiting reassignment from Default Intake ownership.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakeQueuePage,
});

function IntakeQueuePage() {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Default Intake Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Startups and Investors temporarily assigned to Default Intake owners, awaiting
          reassignment.
        </p>
      </header>
      <DefaultIntakePreviewNotice variant="full" />
      <QueueTable />
    </div>
  );
}
