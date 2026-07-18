import { createFileRoute } from "@tanstack/react-router";
import { PermissionGuard } from "@/components/permission-guard";
import { QueueTable } from "@/components/intake/queue-table";

export const Route = createFileRoute("/_authenticated/intake-queue")({
  head: () => ({
    meta: [
      { title: "Default Intake Queue — SnackPortal" },
      {
        name: "description",
        content:
          "Queue of Startups and Investors temporarily assigned to Default Intake ownership, awaiting reassignment.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakeQueuePage,
});

function IntakeQueuePage() {
  return (
    <PermissionGuard
      permission="default_intake.read"
      message="You don't have permission to view the Intake Queue."
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Default Intake Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Records temporarily assigned to Default Intake owners, awaiting reassignment.
          </p>
        </header>
        <QueueTable />
      </div>
    </PermissionGuard>
  );
}
