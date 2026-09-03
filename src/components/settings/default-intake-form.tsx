/**
 * Default Intake — canonical settings form.
 *
 * Single component tree used in every environment. Consumes only the
 * adapter façade. The adapter's mode (mock / transitional / backend)
 * determines the data source; the UI is identical.
 *
 * Guard chain: authentication (managed layout) → `default_intake.read`
 * on the page route → active-tenant enforcement inside the server fn.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";
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
import { useSessionContext, usePermissions } from "@/hooks/use-session-context";
import { defaultIntakeAdapter, type EligibleDefaultIntakeAgent } from "@/lib/default-intake";
import { CreateTenantAiAgentDialog } from "@/components/intake/create-tenant-ai-agent-dialog";
import { ButtonLoading } from "@/components/ui/PitchSnackLoader";

export function DefaultIntakeForm() {
  const { data: session } = useSessionContext();
  const { has } = usePermissions();
  const qc = useQueryClient();

  const tenantId = session?.activeWorkspace.tenantId ?? null;
  const tenantName = session?.activeWorkspace.tenantName ?? null;
  const wsType = session?.activeWorkspace.workspaceType ?? null;

  const configQ = useQuery({
    queryKey: ["default-intake", tenantId],
    queryFn: () => defaultIntakeAdapter.getConfiguration(),
    enabled: !!tenantId && wsType !== "CONTROL",
  });
  const agentsQ = useQuery({
    queryKey: ["default-intake-agents", tenantId],
    queryFn: () => defaultIntakeAdapter.listEligibleAgents(),
    enabled: !!tenantId && wsType !== "CONTROL",
  });

  const cfg = configQ.data ?? null;
  const agents = agentsQ.data ?? {
    startupHumans: [],
    startupAis: [],
    investorHumans: [],
    investorAis: [],
  };

  const [startupHuman, setStartupHuman] = useState<string>("");
  const [startupAi, setStartupAi] = useState<string>("");
  const [investorHuman, setInvestorHuman] = useState<string>("");
  const [investorAi, setInvestorAi] = useState<string>("");
  const [aiDialog, setAiDialog] = useState<null | "startup" | "investor">(null);

  // Initialise selectors once config resolves (each field independently).
  useMemo(() => {
    if (cfg) {
      setStartupHuman((v) => v || cfg.startup.humanAgent.id);
      setStartupAi((v) => v || cfg.startup.aiAgent.id);
      setInvestorHuman((v) => v || cfg.investor.humanAgent.id);
      setInvestorAi((v) => v || cfg.investor.aiAgent.id);
    }
  }, [cfg]);

  const canWrite = has("default_intake.write");
  const canCreateAi = has("default_intake.agent.create");

  const saveM = useMutation({
    mutationFn: () =>
      defaultIntakeAdapter.upsertConfiguration({
        startupHumanId: startupHuman,
        startupAiId: startupAi,
        investorHumanId: investorHuman,
        investorAiId: investorAi,
      }),
    onSuccess: (res) => {
      toast.success(
        `Default Intake configuration saved for ${res.tenantName ?? "this tenant"}.`,
      );
      qc.invalidateQueries({ queryKey: ["default-intake"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -- Active-tenant enforcement (CONTROL global has no tenant scope). -------
  if (!tenantId || wsType === "CONTROL") {
    return (
      <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-5 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <div className="font-medium text-foreground">Select a tenant workspace</div>
          <p className="mt-1 text-muted-foreground">
            Default Intake is scoped per tenant. Use the workspace switcher in the top bar to
            select a tenant (e.g. ACME) before configuring Default Intake.
          </p>
        </div>
      </Card>
    );
  }

  const dirty =
    (cfg &&
      (startupHuman !== cfg.startup.humanAgent.id ||
        startupAi !== cfg.startup.aiAgent.id ||
        investorHuman !== cfg.investor.humanAgent.id ||
        investorAi !== cfg.investor.aiAgent.id)) ||
    (!cfg && (!!startupHuman || !!startupAi || !!investorHuman || !!investorAi));
  const complete = !!startupHuman && !!startupAi && !!investorHuman && !!investorAi;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <IntakeCard
          title="Startup Intake"
          helper="Human owner and Startup AI Agent used when a new Startup is created without final ownership."
          humanLabel="Default Startup Intake Agent"
          aiLabel="Default Startup Intake AI Agent"
          humans={agents.startupHumans}
          ais={agents.startupAis}
          humanValue={startupHuman}
          aiValue={startupAi}
          onHumanChange={setStartupHuman}
          onAiChange={setStartupAi}
          domain="startup"
          onCreateAi={canCreateAi ? () => setAiDialog("startup") : undefined}
          loading={agentsQ.isLoading}
        />
        <IntakeCard
          title="Investor Intake"
          helper="Human owner and Investor AI Agent used when a new Investor is created without final ownership."
          humanLabel="Default Investor Intake Agent"
          aiLabel="Default Investor Intake AI Agent"
          humans={agents.investorHumans}
          ais={agents.investorAis}
          humanValue={investorHuman}
          aiValue={investorAi}
          onHumanChange={setInvestorHuman}
          onAiChange={setInvestorAi}
          domain="investor"
          onCreateAi={canCreateAi ? () => setAiDialog("investor") : undefined}
          loading={agentsQ.isLoading}
        />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-3 shadow-card backdrop-blur">
        <div className="flex min-h-[1.5rem] items-center gap-2 text-xs text-muted-foreground">
          {saveM.isPending ? (
            <>
              <span className="ps-btn-loading">
                <ButtonLoading label="Saving…" invert={false} />
              </span>
            </>
          ) : dirty ? (
            <>
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Unsaved changes for{" "}
              {tenantName ?? "this tenant"}.
            </>
          ) : cfg ? (
            <span>All fields saved for {tenantName ?? "this tenant"}.</span>
          ) : (
            <span>Choose default owners to save the first configuration for this tenant.</span>
          )}
        </div>
        <div className="flex gap-2">
          {cfg && (
            <Button
              variant="outline"
              disabled={!dirty || saveM.isPending}
              onClick={() => {
                setStartupHuman(cfg.startup.humanAgent.id);
                setStartupAi(cfg.startup.aiAgent.id);
                setInvestorHuman(cfg.investor.humanAgent.id);
                setInvestorAi(cfg.investor.aiAgent.id);
              }}
            >
              Reset
            </Button>
          )}
          <Button
            onClick={() => saveM.mutate()}
            disabled={!canWrite || !complete || !dirty || saveM.isPending}
          >
            Save configuration
          </Button>
        </div>
      </div>

      {aiDialog && (
        <CreateTenantAiAgentDialog
          open={!!aiDialog}
          onOpenChange={(o) => !o && setAiDialog(null)}
          domain={aiDialog}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["default-intake-agents"] });
            setAiDialog(null);
          }}
        />
      )}
    </div>
  );
}

function IntakeCard({
  title,
  helper,
  humanLabel,
  aiLabel,
  humans,
  ais,
  humanValue,
  aiValue,
  onHumanChange,
  onAiChange,
  domain,
  onCreateAi,
  loading,
}: {
  title: string;
  helper: string;
  humanLabel: string;
  aiLabel: string;
  humans: EligibleDefaultIntakeAgent[];
  ais: EligibleDefaultIntakeAgent[];
  humanValue: string;
  aiValue: string;
  onHumanChange: (v: string) => void;
  onAiChange: (v: string) => void;
  domain: "startup" | "investor";
  onCreateAi?: () => void;
  loading: boolean;
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
        <Select value={humanValue} onValueChange={onHumanChange} disabled={humans.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading…" : "Select a human agent"} />
          </SelectTrigger>
          <SelectContent>
            {humans.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && humans.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No active human members in this tenant.{" "}
            <a href="/users" className="underline underline-offset-2">
              Invite a user in Users
            </a>
            .
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">{aiLabel}</Label>
          {onCreateAi && (
            <button
              type="button"
              onClick={onCreateAi}
              className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Create AI Agent
            </button>
          )}
        </div>
        <Select value={aiValue} onValueChange={onAiChange} disabled={ais.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading…" : "Select an AI agent"} />
          </SelectTrigger>
          <SelectContent>
            {ais.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && ais.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No {domain === "startup" ? "TENANT_STARTUP_AI" : "TENANT_INVESTOR_AI"} agent in this
            tenant. Use “Create AI Agent” to add one.
          </p>
        )}
      </div>
    </Card>
  );
}
