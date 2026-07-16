/**
 * Default Intake — Agent impact preview panel.
 *
 * A compact card intended to sit next to the user administration surface.
 * Shows the four Default Intake role holders and offers a "Preview
 * deactivation impact" button per role. PRESENTATION ONLY.
 */
import { useState } from "react";
import { Bot, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  getDefaultIntakePreviewConfiguration,
  type DefaultIntakeActorType,
  type DefaultIntakeDomain,
} from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";
import { DeactivateAgentDialog } from "@/components/users/deactivate-agent-dialog";

interface Target {
  agentName: string;
  actorType: DefaultIntakeActorType;
  domain: DefaultIntakeDomain;
}

export function AgentImpactPanel({ className }: { className?: string }) {
  const [target, setTarget] = useState<Target | null>(null);
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;
  const cfg = getDefaultIntakePreviewConfiguration();
  if (!cfg) return null;

  const rows: Array<
    Target & { roleLabel: string; icon: typeof UserCircle2 }
  > = [
    {
      agentName: cfg.startup.humanAgent.name,
      actorType: "human",
      domain: "startup",
      roleLabel: "Default Startup Intake Agent",
      icon: UserCircle2,
    },
    {
      agentName: cfg.startup.aiAgent.name,
      actorType: "ai",
      domain: "startup",
      roleLabel: "Default Startup Intake AI Agent",
      icon: Bot,
    },
    {
      agentName: cfg.investor.humanAgent.name,
      actorType: "human",
      domain: "investor",
      roleLabel: "Default Investor Intake Agent",
      icon: UserCircle2,
    },
    {
      agentName: cfg.investor.aiAgent.name,
      actorType: "ai",
      domain: "investor",
      roleLabel: "Default Investor Intake AI Agent",
      icon: Bot,
    },
  ];

  return (
    <Card className={cn("space-y-3 p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Default Intake — Agent impact preview
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Preview what would happen if one of these Agents were deactivated.
          </p>
        </div>
        <DefaultIntakePreviewNotice variant="compact" />
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li
              key={`${r.domain}-${r.actorType}`}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
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
                onClick={() =>
                  setTarget({
                    agentName: r.agentName,
                    actorType: r.actorType,
                    domain: r.domain,
                  })
                }
              >
                Preview deactivation
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
