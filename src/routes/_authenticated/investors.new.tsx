import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InvestorForm } from "@/components/investors/investor-form";
import { PermissionGuard } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/investors/new")({
  head: () => ({ meta: [{ title: "New Investor — SnackPortal2" }] }),
  component: NewInvestorPage,
});

function NewInvestorPage() {
  return (
    <PermissionGuard permission="investors.write" message="You don't have permission to create investors.">
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
    </PermissionGuard>
  );
}
