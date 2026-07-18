/**
 * Default Intake — Ownership assignment info banner on create forms.
 *
 * Adapter-driven. When real Default Intake settings exist for the active
 * tenant, this section shows the domain-specific default owners so the
 * user knows who will own the new record if they don't override the
 * ownership fields below. Non-blocking — never mutates form state.
 */
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultIntakeAdapter, type DefaultIntakeDomain } from "@/lib/default-intake";

export interface OwnershipModeSectionProps {
  domain: DefaultIntakeDomain;
  helperText?: string;
  className?: string;
}

export function DefaultIntakeOwnershipModeSection({
  domain,
  helperText,
  className,
}: OwnershipModeSectionProps) {
  const { data: cfg } = useQuery({
    queryKey: ["default-intake"],
    queryFn: () => defaultIntakeAdapter.getConfiguration(),
    staleTime: 60_000,
  });
  if (!cfg) return null;

  const { humanAgent, aiAgent } = domain === "startup" ? cfg.startup : cfg.investor;
  const humanLabel =
    domain === "startup" ? "Default Startup Intake Agent" : "Default Investor Intake Agent";
  const aiLabel =
    domain === "startup" ? "Default Startup Intake AI Agent" : "Default Investor Intake AI Agent";

  return (
    <section
      className={cn(
        "space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs",
        className,
      )}
      aria-labelledby="default-intake-info-heading"
    >
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <h3 id="default-intake-info-heading" className="text-sm font-semibold text-foreground">
          Default Intake for this tenant
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <OwnerRow label={humanLabel} name={humanAgent.name} />
        <OwnerRow label={aiLabel} name={aiAgent.name} />
      </div>
      <p className="text-muted-foreground">
        {helperText ??
          "These are the default owners for new records. Override them in the Ownership fields below to pick different owners."}
      </p>
    </section>
  );
}

function OwnerRow({ label, name }: { label: string; name: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground">{name}</div>
    </div>
  );
}
