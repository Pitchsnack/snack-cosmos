import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/startups/new")({
  head: () => ({ meta: [{ title: "New Startup — SnackPortal2" }] }),
  component: NewStartupPage,
});

function NewStartupPage() {
  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to create startups.">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/startups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to startups
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">New startup</h1>
          <p className="mt-1 text-sm text-muted-foreground">Provide basic details and assign required ownership.</p>
        </div>
        <StartupForm />
      </div>
    </PermissionGuard>
  );
}
