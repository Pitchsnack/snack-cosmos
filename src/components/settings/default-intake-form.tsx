/**
 * Default Intake Settings — preview form.
 *
 * Presentation-only. Reads fixture defaults from the preview adapter and
 * allows local, non-persistent selection changes. Save produces a visual
 * success message only — NO server call, NO cache mutation.
 */
import { useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  getDefaultIntakePreviewConfiguration,
} from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";

const HUMAN_OPTIONS_STARTUP = ["Sarah Chen", "Aliyah Ross", "Marco Bianchi"];
const AI_OPTIONS_STARTUP = ["Startup Analysis AI", "Startup Enrichment AI (beta)"];
const HUMAN_OPTIONS_INVESTOR = ["David Lim", "Priya Nair", "Jonas Weber"];
const AI_OPTIONS_INVESTOR = ["Investor Mandate AI", "Investor Portfolio AI (beta)"];

export function DefaultIntakeForm() {
  const cfg = useMemo(() => getDefaultIntakePreviewConfiguration(), []);

  const [startupHuman, setStartupHuman] = useState(cfg?.startup.humanAgent.name ?? "");
  const [startupAi, setStartupAi] = useState(cfg?.startup.aiAgent.name ?? "");
  const [investorHuman, setInvestorHuman] = useState(cfg?.investor.humanAgent.name ?? "");
  const [investorAi, setInvestorAi] = useState(cfg?.investor.aiAgent.name ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  if (!DEFAULT_INTAKE_PREVIEW_ENABLED) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        Default Intake preview is disabled. Set{" "}
        <code className="rounded bg-muted px-1">VITE_DEFAULT_INTAKE_PREVIEW=true</code> to enable
        this screen.
      </div>
    );
  }
  if (!cfg) return null;

  const setField = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
    setSavedMessage(null);
  };

  const handleSave = () => {
    // PREVIEW ONLY — no server call, no cache write, no persistence.
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setDirty(false);
      setSavedMessage("Preview only — configuration was not persisted.");
    }, 400);
  };

  return (
    <div className="space-y-6">
      <DefaultIntakePreviewNotice variant="full" />

      <div className="grid gap-4 lg:grid-cols-2">
        <IntakeCard
          title="Startup Intake"
          helper="Startup Analysis AI supports enrichment, classification, missing-data review, investment-stage analysis, and matching preparation."
          humanLabel="Default Startup Intake Agent"
          aiLabel="Default Startup Intake AI Agent"
          humanValue={startupHuman}
          aiValue={startupAi}
          humanOptions={HUMAN_OPTIONS_STARTUP}
          aiOptions={AI_OPTIONS_STARTUP}
          onHumanChange={setField(setStartupHuman)}
          onAiChange={setField(setStartupAi)}
        />
        <IntakeCard
          title="Investor Intake"
          helper="Investor Mandate AI supports mandate, sector, geography, ticket-size, portfolio-fit, and matching preparation."
          humanLabel="Default Investor Intake Agent"
          aiLabel="Default Investor Intake AI Agent"
          humanValue={investorHuman}
          aiValue={investorAi}
          humanOptions={HUMAN_OPTIONS_INVESTOR}
          aiOptions={AI_OPTIONS_INVESTOR}
          onHumanChange={setField(setInvestorHuman)}
          onAiChange={setField(setInvestorAi)}
        />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-3 shadow-card backdrop-blur">
        <div className="flex min-h-[1.5rem] items-center gap-2 text-xs text-muted-foreground">
          {dirty ? (
            <>
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Unsaved changes — preview only, will not persist.
            </>
          ) : savedMessage ? (
            <span
              role="status"
              aria-live="polite"
              className="font-medium text-amber-700 dark:text-amber-300"
            >
              {savedMessage}
            </span>
          ) : (
            <span>All fields populated from fixture defaults.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setStartupHuman(cfg.startup.humanAgent.name);
              setStartupAi(cfg.startup.aiAgent.name);
              setInvestorHuman(cfg.investor.humanAgent.name);
              setInvestorAi(cfg.investor.aiAgent.name);
              setDirty(false);
              setSavedMessage(null);
            }}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save (preview)"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntakeCard({
  title,
  helper,
  humanLabel,
  aiLabel,
  humanValue,
  aiValue,
  humanOptions,
  aiOptions,
  onHumanChange,
  onAiChange,
}: {
  title: string;
  helper: string;
  humanLabel: string;
  aiLabel: string;
  humanValue: string;
  aiValue: string;
  humanOptions: string[];
  aiOptions: string[];
  onHumanChange: (v: string) => void;
  onAiChange: (v: string) => void;
}) {
  return (
    <Card className={cn("space-y-4 p-5")}>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">{humanLabel}</Label>
        <Select value={humanValue} onValueChange={onHumanChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a human agent" />
          </SelectTrigger>
          <SelectContent>
            {humanOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">{aiLabel}</Label>
        <Select value={aiValue} onValueChange={onAiChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an AI agent" />
          </SelectTrigger>
          <SelectContent>
            {aiOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
