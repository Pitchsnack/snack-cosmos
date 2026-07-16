/**
 * Default Intake — Ownership Assignment mode selector for create forms.
 *
 * Renders ONLY when VITE_DEFAULT_INTAKE_PREVIEW === "true". Shows a
 * two-mode radio (Use Default Intake Assignment / Select final owners now)
 * and, in Default mode, shows the preview owners for the given domain.
 *
 * PRESENTATION ONLY — does not read or write ownership state; the existing
 * form fields remain the source of truth. On preview Save this component
 * emits nothing to the server.
 */
import { useState } from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { DEFAULT_INTAKE_PREVIEW_ENABLED } from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";
import {
  DefaultIntakeOwnershipPreview,
  type DefaultIntakeOwnershipPreviewProps,
} from "@/components/intake/default-intake-ownership-preview";

export type OwnershipMode = "default" | "final";

export interface OwnershipModeSectionProps {
  domain: DefaultIntakeOwnershipPreviewProps["domain"];
  helperText?: string;
  className?: string;
}

export function DefaultIntakeOwnershipModeSection({
  domain,
  helperText,
  className,
}: OwnershipModeSectionProps) {
  const [mode, setMode] = useState<OwnershipMode>("default");
  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) return null;

  const domainLabel = domain === "startup" ? "Startup" : "Investor";

  return (
    <section
      aria-labelledby="default-intake-mode-heading"
      className={cn("space-y-3 rounded-lg border border-border bg-card p-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="default-intake-mode-heading"
          className="text-sm font-semibold text-foreground"
        >
          Ownership Assignment
        </h3>
        <DefaultIntakePreviewNotice variant="compact" />
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(v) => setMode(v as OwnershipMode)}
        className="space-y-2"
      >
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:bg-muted/40">
          <RadioGroupItem value="default" id={`di-mode-default-${domain}`} className="mt-0.5" />
          <div className="min-w-0">
            <Label
              htmlFor={`di-mode-default-${domain}`}
              className="cursor-pointer text-sm font-medium"
            >
              Use Default Intake Assignment
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Temporarily assign to the {domainLabel.toLowerCase()} intake team and add to the
              Default Intake Queue.
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:bg-muted/40">
          <RadioGroupItem value="final" id={`di-mode-final-${domain}`} className="mt-0.5" />
          <div className="min-w-0">
            <Label
              htmlFor={`di-mode-final-${domain}`}
              className="cursor-pointer text-sm font-medium"
            >
              Select final owners now
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Use the ownership fields below to pick the permanent owners.
            </p>
          </div>
        </label>
      </RadioGroup>

      {mode === "default" ? (
        <DefaultIntakeOwnershipPreview domain={domain} helperText={helperText} />
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Fill in the Human owner and AI owner fields below to select final ownership.</span>
        </div>
      )}
    </section>
  );
}
