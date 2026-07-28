import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StartupForm } from "@/components/startups/startup-form";
import { PermissionGuard } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/my-startups/new")({
  head: () => ({
    meta: [
      { title: "Add My Startup — SnackPortal2" },
      { name: "description", content: "Create a new startup profile in My Startups." },
    ],
  }),
  component: NewMyStartupPage,
});

function NewMyStartupPage() {
  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to create startups.">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to="/my-startups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to My Startups
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Add my startup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your startup profile. Complete company details, media, founders, and investors.
          </p>
        </div>
        <StartupForm redirectAfterCreate="my-startups" />
      </div>
    </PermissionGuard>
  );
}
