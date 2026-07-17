/**
 * TEMPORARY — CONTROL-only toggle for the Default Intake preview feature flag.
 *
 * This button exists to let CONTROL flip `VITE_DEFAULT_INTAKE_PREVIEW` at
 * runtime (via a client-side localStorage override) during the design phase.
 * It performs NO backend calls and will be removed once design is complete.
 */
import { FlaskConical, FlaskRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionContext } from "@/hooks/use-session-context";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  setDefaultIntakePreviewOverride,
} from "@/lib/preview/default-intake-preview-adapter";

export function DefaultIntakeFlagToggle() {
  const { data } = useSessionContext();
  const isControl = (data?.roles ?? []).includes("CONTROL");
  if (!isControl) return null;

  const on = DEFAULT_INTAKE_PREVIEW_ENABLED;
  const label = on ? "Disable Default Intake preview" : "Enable Default Intake preview";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={on}
            aria-label={label}
            onClick={() => setDefaultIntakePreviewOverride(!on)}
            className={
              on
                ? "h-8 gap-1.5 border-amber-500/60 bg-amber-500/10 px-2 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
                : "h-8 gap-1.5 px-2"
            }
          >
            {on ? (
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <FlaskRound className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="text-[11px] font-medium uppercase tracking-wide">
              Intake preview {on ? "on" : "off"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Temporary CONTROL toggle — reloads the app. Removed after design phase.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
