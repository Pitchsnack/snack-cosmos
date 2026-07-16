/**
 * Default Intake preview — reusable ownership summary block.
 *
 * Shows the fixture Default Intake human + AI owners for a given domain,
 * with a "Needs reassignment" status label. Renders ONLY when the preview
 * flag is ON. Purely presentational.
 */
import { UserCircle2, Bot, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  getDefaultIntakePreviewConfiguration,
  type DefaultIntakeDomain,
} from "@/lib/preview/default-intake-preview-adapter";

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
      className={cn(
        "rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm",
        className,
      )}
      data-preview="default-intake-ownership"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <UserCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Human owner
            </div>
            <div className="truncate font-medium text-foreground">{humanAgent.name}</div>
            <div className="text-xs text-muted-foreground">{humanLabel}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Bot
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              AI owner
            </div>
            <div className="truncate font-medium text-foreground">{aiAgent.name}</div>
            <div className="text-xs text-muted-foreground">{aiLabel}</div>
          </div>
        </div>
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
    </div>
  );
}
