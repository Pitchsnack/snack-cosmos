import { createFileRoute } from "@tanstack/react-router";
import { PermissionGuard } from "@/components/permission-guard";
import { DefaultIntakeForm } from "@/components/settings/default-intake-form";

export const Route = createFileRoute("/_authenticated/settings/default-intake")({
  head: () => ({
    meta: [
      { title: "Default Intake Assignment — SnackPortal" },
      {
        name: "description",
        content:
          "Configure per-tenant default human and AI owners assigned when a Startup or Investor is created without final ownership.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DefaultIntakeSettingsPage,
});

function DefaultIntakeSettingsPage() {
  return (
    <PermissionGuard
      permission="default_intake.read"
      message="You don't have permission to configure Default Intake."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Default Intake Assignment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the default human and AI owners used when a Startup or Investor is created
            without final ownership. Scoped to the active tenant workspace.
          </p>
        </header>
        <DefaultIntakeForm />
      </div>
    </PermissionGuard>
  );
}
