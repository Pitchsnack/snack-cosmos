/**
 * Default Intake — Agent impact panel on the /users page.
 *
 * Renders the four Default Intake role holders (per active tenant) and
 * offers a Deactivate confirmation. Sources data from the canonical
 * adapter; when the active tenant has no Default Intake configuration
 * yet, renders a controlled empty state.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  defaultIntakeAdapter,
  type DefaultIntakeActorType,
  type DefaultIntakeDomain,
} from "@/lib/default-intake";
import { DeactivateAgentDialog } from "@/components/users/deactivate-agent-dialog";

interface Target {
  agentName: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
}

export function AgentImpactPanel({ className }: { className?: string }) {
  const [target, setTarget] = useState<Target | null>(null);
  const { data: cfg } = useQuery({
    queryKey: ["default-intake"],
    queryFn: () => defaultIntakeAdapter.getConfiguration(),
    staleTime: 60_000,
  });
  if (!cfg) return null;

  const rows: Array<Target & { roleLabel: string; icon: typeof UserCircle2 }> = [
    { agentName: cfg.startup.humanAgent.name, actorType: "human", domain: "startup", roleLabel: "Default Startup Intake Agent", icon: UserCircle2 },
    { agentName: cfg.startup.aiAgent.name, actorType: "ai", domain: "startup", roleLabel: "Default Startup Intake AI Agent", icon: Bot },
    { agentName: cfg.investor.humanAgent.name, actorType: "human", domain: "investor", roleLabel: "Default Investor Intake Agent", icon: UserCircle2 },
    { agentName: cfg.investor.aiAgent.name, actorType: "ai", domain: "investor", roleLabel: "Default Investor Intake AI Agent", icon: Bot },
  ];

  return (
    <Card className={cn("space-y-3 p-5", className)}>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Default Intake — Agent impact
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Deactivating a default owner requires a replacement (blocked by the DB trigger otherwise).
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={`${r.domain}-${r.actorType}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.agentName}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.roleLabel}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setTarget({ agentName: r.agentName, actorType: r.actorType, domain: r.domain })}
              >
                Deactivate
              </Button>
            </li>
          );
        })}
      </ul>
      {target && (
        <DeactivateAgentDialog
          open={!!target}
          onOpenChange={(v) => !v && setTarget(null)}
          agentName={target.agentName}
          actorType={target.actorType}
          domain={target.domain}
        />
      )}
    </Card>
  );
}
