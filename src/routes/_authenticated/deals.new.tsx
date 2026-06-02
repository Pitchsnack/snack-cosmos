import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DealForm } from "@/components/deals/deal-form";
import { usePermissions } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/deals/new")({
  head: () => ({ meta: [{ title: "New Deal — SnackPortal2" }] }),
  component: NewDealPage,
});

function NewDealPage() {
  const { has } = usePermissions();
  if (!has("deals.write")) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        You don't have permission to create deals.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New deal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Link a startup and investor, assign required ownership.</p>
      </div>
      <DealForm />
    </div>
  );
}
