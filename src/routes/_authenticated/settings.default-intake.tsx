import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DEFAULT_INTAKE_PREVIEW_ENABLED } from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakeForm } from "@/components/settings/default-intake-form";

export const Route = createFileRoute("/_authenticated/settings/default-intake")({
  head: () => ({
    meta: [
      { title: "Default Intake Assignment — Preview" },
      {
        name: "description",
        content:
          "Preview the temporary human and AI owners used when a Startup or Investor is created without final ownership.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DefaultIntakeSettingsPage,
});

function DefaultIntakeSettingsPage() {
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) {
    // Flag OFF: route is inert; fall back to the dashboard.
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Default Intake Assignment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the temporary human and AI owners used when a Startup or Investor is created
          without final ownership.
        </p>
      </header>
      <DefaultIntakeForm />
    </div>
  );
}
