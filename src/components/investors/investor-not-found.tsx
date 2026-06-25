import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestorNotFound({ reason }: { reason: "invalid" | "missing" }) {
  const title = reason === "invalid" ? "Invalid link" : "Investor not found";
  const body =
    reason === "invalid"
      ? "This URL does not point to a valid investor. Investors are addressed by their unique ID."
      : "This investor may have been removed, archived, or isn't accessible in your current tenant.";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/investors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to investors
      </Link>
      <div className="rounded-lg border border-border bg-card p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/investors">Back to investors</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
