import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { InvestorForm, type InvestorEditModel } from "@/components/investors/investor-form";
import { PermissionGuard } from "@/components/permission-guard";
import { useInvestor } from "@/hooks/use-investor";
import { isUuid } from "@/lib/uuid";
import { InvestorNotFound } from "@/components/investors/investor-not-found";

export const Route = createFileRoute("/_authenticated/investors/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Investor — SnackPortal2" }] }),
  component: EditInvestorPage,
});

function EditInvestorPage() {
  const { id } = Route.useParams();
  const validId = isUuid(id);
  const { data, isLoading, error } = useInvestor(validId ? id : undefined);

  if (!validId) {
    return (
      <PermissionGuard permission="investors.write" message="You don't have permission to edit investors.">
        <InvestorNotFound reason="invalid" />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="investors.write" message="You don't have permission to edit investors.">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/investors/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to investor
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit investor</h1>
        </div>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (error || !data) && <InvestorNotFound reason="missing" />}
        {data && <InvestorForm investor={data as unknown as InvestorEditModel} />}
      </div>
    </PermissionGuard>
  );
}
