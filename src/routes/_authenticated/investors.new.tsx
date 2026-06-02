import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InvestorForm } from "@/components/investors/investor-form";
import { usePermissions } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/investors/new")({
  head: () => ({ meta: [{ title: "New Investor — SnackPortal2" }] }),
  component: NewInvestorPage,
});

function NewInvestorPage() {
  const { has } = usePermissions();
  if (!has("investors.write")) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        You don't have permission to create investors.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/investors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to investors
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New investor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Provide basic details and assign required ownership.</p>
      </div>
      <InvestorForm />
    </div>
  );
}
