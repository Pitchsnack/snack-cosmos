import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Explicit tenant-context conflict notice.
 *
 * Presentation only: it never resolves the active workspace itself — both
 * workspace names are supplied by the caller from the approved session /
 * workspace context. No routing, permission or backend inference here.
 */
export interface WorkspaceConflictNoticeProps {
  /** Workspace the record/selection belongs to. */
  recordWorkspaceName: string | null;
  /** Currently active workspace from session context. */
  activeWorkspaceName: string | null;
  /** Invoked when the user chooses to switch to the record workspace. */
  onSwitch?: () => void | Promise<void>;
  /** Invoked when the user chooses to stay in the active workspace. */
  onStay?: () => void;
  switching?: boolean;
  /** Disables the switch action (e.g. preview fixtures). */
  switchDisabled?: boolean;
  switchDisabledReason?: string;
  error?: string | null;
  className?: string;
}

export function WorkspaceConflictNotice({
  recordWorkspaceName,
  activeWorkspaceName,
  onSwitch,
  onStay,
  switching = false,
  switchDisabled = false,
  switchDisabledReason,
  error,
  className,
}: WorkspaceConflictNoticeProps) {
  const [stayed, setStayed] = useState(false);

  const recordName = recordWorkspaceName ?? "another workspace";
  const activeName = activeWorkspaceName;

  const message = activeName
    ? `This record belongs to ${recordName}. You are currently working in ${activeName}. Switch to ${recordName} to continue.`
    : `This record belongs to ${recordName}. You have no active workspace. Switch to ${recordName} to continue.`;

  return (
    <div
      role="alert"
      className={cn(
        "space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {activeName && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            aria-pressed={stayed}
            onClick={() => {
              setStayed(true);
              onStay?.();
            }}
          >
            Stay in {activeName}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={switching || switchDisabled || !onSwitch}
          aria-busy={switching || undefined}
          onClick={() => void onSwitch?.()}
        >
          {switching ? `Switching to ${recordName}…` : `Switch to ${recordName}`}
        </Button>
        {switchDisabled && switchDisabledReason && (
          <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
            {switchDisabledReason}
          </span>
        )}
        {error && <span className="text-destructive">{error}</span>}
      </div>

      {stayed && activeName && (
        <p role="status" className="text-[11px] text-amber-800 dark:text-amber-200">
          Staying in {activeName}. This record stays read-only for the current workspace until
          you switch to {recordName}.
        </p>
      )}
    </div>
  );
}
