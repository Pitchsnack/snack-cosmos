/**
 * Default Intake preview — reusable ownership summary block.
 *
 * Shows the fixture Default Intake human + AI owners for a given domain,
 * with a "Needs reassignment" status label and, beside each preview owner,
 * a "Create real Agent from this template" action that opens the appropriate
 * setup dialog. Renders ONLY when the preview flag is ON.
 *
 * The action button does NOT convert the fixture ID into a real user; it
 * seeds a Human or AI setup form whose submit path is gated on the future
 * backend provisioning boundary. Fixture IDs never cross the server line.
 */
import { useState } from "react";
import { UserCircle2, Bot, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  getDefaultIntakePreviewConfiguration,
  type DefaultIntakeDomain,
} from "@/lib/preview/default-intake-preview-adapter";
import { CreateRealAgentDialog } from "@/components/intake/create-real-agent-dialog";
import type { DefaultIntakeActorType } from "@/lib/default-intake";

export interface DefaultIntakeOwnershipPreviewProps {
  domain: DefaultIntakeDomain;
  className?: string;
  helperText?: string;
  showStatus?: boolean;
}

export function DefaultIntakeOwnershipPreview({
  domain,
  className,
  helperText,
  showStatus = true,
}: DefaultIntakeOwnershipPreviewProps) {
  const [dialog, setDialog] = useState<{
    actorType: DefaultIntakeActorType;
    templateName: string;
  } | null>(null);

  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;
  const cfg = getDefaultIntakePreviewConfiguration();
  if (!cfg) return null;

  const { humanAgent, aiAgent } = domain === "startup" ? cfg.startup : cfg.investor;
  const humanLabel =
    domain === "startup" ? "Default Startup Intake Agent" : "Default Investor Intake Agent";
  const aiLabel =
    domain === "startup" ? "Default Startup Intake AI Agent" : "Default Investor Intake AI Agent";

  return (
    <div
      className={cn("rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm", className)}
      data-preview="default-intake-ownership"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewOwnerCard
          icon={<UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
          kindLabel="Human owner"
          name={humanAgent.name}
          roleLabel={humanLabel}
          onCreateReal={() =>
            setDialog({ actorType: "human", templateName: humanAgent.name })
          }
        />
        <PreviewOwnerCard
          icon={<Bot className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
          kindLabel="AI owner"
          name={aiAgent.name}
          roleLabel={aiLabel}
          onCreateReal={() => setDialog({ actorType: "ai", templateName: aiAgent.name })}
        />
      </div>
      {showStatus && (
        <div className="mt-3 flex items-center gap-2 border-t border-amber-500/30 pt-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-medium">Assignment status: Needs reassignment</span>
        </div>
      )}
      {helperText && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helperText}</p>
      )}

      {dialog && (
        <CreateRealAgentDialog
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          actorType={dialog.actorType}
          domain={domain}
          templateName={dialog.templateName}
          tenantId={cfg.tenantId}
        />
      )}
    </div>
  );
}

function PreviewOwnerCard({
  icon,
  kindLabel,
  name,
  roleLabel,
  onCreateReal,
}: {
  icon: React.ReactNode;
  kindLabel: string;
  name: string;
  roleLabel: string;
  onCreateReal: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {kindLabel}
        </div>
        <div className="truncate font-medium text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground">{roleLabel}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Preview fixture
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Not a real tenant user
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreateReal}
          className="mt-2 h-7 gap-1.5 text-[11px]"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Create real Agent from this template
        </Button>
      </div>
    </div>
  );
}
