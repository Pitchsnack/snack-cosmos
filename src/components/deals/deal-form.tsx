import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createDeal, listStartupOptions, listInvestorOptions,
  DEAL_STAGES, DEAL_VISIBILITIES,
} from "@/lib/deals.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { listAssignableTenants } from "@/lib/tenants.functions";
import { queryAssignableTenants } from "@/lib/assignable-tenants-query";
import { switchWorkspace } from "@/lib/session-context.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";

// Preview-only feature flag. Production stays OFF pending Option A backend
// PRD (MASTER_AGENT authorization + physical tenant-database readiness).
const WORKSPACE_ENFORCEMENT_ENABLED =
  import.meta.env.VITE_WORKSPACE_ENFORCEMENT === "true";

// Preview-only, non-persistent fixture tenants. Rendered ONLY when the flag
// is ON and the merged real list is empty. Never call switchWorkspace, never
// mutate session state, never select a physical database, never persist.
const FIXTURE_TENANT_PREFIX = "fixture-preview-";
const FIXTURE_TENANTS = [
  { tenantId: `${FIXTURE_TENANT_PREFIX}alpha`, tenantName: "Acme Ventures (preview fixture)", tenantCode: "ACME-FX" },
  { tenantId: `${FIXTURE_TENANT_PREFIX}beta`, tenantName: "Nova Capital (preview fixture)", tenantCode: "NOVA-FX" },
];
const isFixtureTenant = (id: string | null | undefined): boolean =>
  !!id && id.startsWith(FIXTURE_TENANT_PREFIX);

function mapSwitchError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("forbidden") || lower.includes("not a member") || lower.includes("access")) {
    return "You do not have access to this tenant workspace.";
  }
  if (lower.includes("not ready") || lower.includes("provision") || lower.includes("readiness")) {
    return "This tenant workspace is still being prepared.";
  }
  return "Unable to switch workspace. Please try again.";
}

export function DealForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createDeal);
  const fetchUsers = useServerFn(listAssignableUsers);
  const fetchStartups = useServerFn(listStartupOptions);
  const fetchInvestors = useServerFn(listInvestorOptions);
  const fetchAssignableTenants = useServerFn(listAssignableTenants);
  const doSwitch = useServerFn(switchWorkspace);
  const [switchPending, setSwitchPending] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const enabled = useHasSession();

  const sessionTenants = useMemo(() => session?.tenants ?? [], [session]);
  const principalRef = session?.user?.id ?? null;

  // Authorized-choice list only (flag ON). Not authorization, membership,
  // routing, or physical-database selection.
  const assignableQ = useQuery({
    queryKey: ["assignable-tenants", principalRef],
    queryFn: () => queryAssignableTenants(fetchAssignableTenants),
    enabled: WORKSPACE_ENFORCEMENT_ENABLED && enabled && !!principalRef,
    staleTime: 60_000,
  });

  const mergedTenants = useMemo(() => {
    if (!WORKSPACE_ENFORCEMENT_ENABLED) {
      return sessionTenants.map((t) => ({
        tenantId: t.tenantId, tenantName: t.tenantName, tenantCode: t.tenantCode,
      }));
    }
    const map = new Map<string, { tenantId: string; tenantName: string; tenantCode: string }>();
    for (const t of sessionTenants) {
      map.set(t.tenantId, { tenantId: t.tenantId, tenantName: t.tenantName, tenantCode: t.tenantCode });
    }
    for (const t of assignableQ.data ?? []) {
      if (!map.has(t.id)) {
        map.set(t.id, { tenantId: t.id, tenantName: t.tenantName, tenantCode: t.tenantCode });
      }
    }
    const merged = Array.from(map.values()).sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }),
    );
    if (
      WORKSPACE_ENFORCEMENT_ENABLED &&
      merged.length === 0 &&
      !assignableQ.isLoading &&
      !assignableQ.isError
    ) {
      return [...FIXTURE_TENANTS];
    }
    return merged;
  }, [sessionTenants, assignableQ.data, assignableQ.isLoading, assignableQ.isError]);
  const tenants = mergedTenants;

  const activeTenantId = session?.activeWorkspace.tenantId ?? null;
  const activeTenantName = session?.activeWorkspace.tenantName ?? null;

  const [tenantId, setTenantId] = useState<string>("");

  const tenantMatchesActive =
    !!activeTenantId && !!tenantId && activeTenantId === tenantId;
  const selectedTenantName =
    mergedTenants.find((t) => t.tenantId === tenantId)?.tenantName ?? null;

  useEffect(() => {
    if (tenantId) return;
    if (!tenants.length) return;
    if (WORKSPACE_ENFORCEMENT_ENABLED) {
      if (activeTenantId && tenants.some((t) => t.tenantId === activeTenantId)) {
        setTenantId(activeTenantId);
      }
    } else {
      setTenantId(activeTenantId ?? tenants[0].tenantId);
    }
  }, [tenants, tenantId, activeTenantId]);

  const [dealName, setDealName] = useState("");
  const [startupId, setStartupId] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [stage, setStage] = useState<string>("Prospecting");
  const [visibility, setVisibility] = useState<string>("Tenant Visible");
  const [investmentAmount, setAmount] = useState("");
  const [probability, setProbability] = useState("");
  const [expectedCloseDate, setClose] = useState("");
  const [notes, setNotes] = useState("");
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

  // Clear tenant-dependent selections when tenant changes or active-match is
  // lost — flag ON only. Deal form is create-only, so no edit-mode branch.
  useEffect(() => {
    if (!WORKSPACE_ENFORCEMENT_ENABLED) return;
    setStartupId("");
    setInvestorId("");
    setOwningAgent("");
    setOwningAi("");
  }, [tenantId, tenantMatchesActive]);

  const depsEnabled =
    enabled && !!tenantId && (!WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive);

  const startupsQ = useQuery({
    queryKey: ["deal-startups", tenantId],
    queryFn: () => fetchStartups({ data: { tenantId } }),
    enabled: depsEnabled,
  });
  const investorsQ = useQuery({
    queryKey: ["deal-investors", tenantId],
    queryFn: () => fetchInvestors({ data: { tenantId } }),
    enabled: depsEnabled,
  });
  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: depsEnabled,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: depsEnabled,
  });

  const gate = !WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive;
  const startupOptions = gate ? (startupsQ.data ?? []) : [];
  const investorOptions = gate ? (investorsQ.data ?? []) : [];
  const humanOptions = gate ? (humansQ.data ?? []) : [];
  const aiOptions = gate ? (aisQ.data ?? []) : [];

  const m = useMutation({
    mutationFn: async (vars: { selectedTenantId: string; activeTenantId: string | null }) => {
      if (WORKSPACE_ENFORCEMENT_ENABLED) {
        if (
          !vars.activeTenantId ||
          !vars.selectedTenantId ||
          vars.activeTenantId !== vars.selectedTenantId
        ) {
          throw new Error(
            "Selected tenant is not the active workspace. Switch workspace to continue.",
          );
        }
      }
      return create({
        data: {
          tenantId: vars.selectedTenantId,
          dealName,
          startupId,
          investorId,
          stage: stage as never,
          visibility: visibility as never,
          investmentAmount: investmentAmount ? Number(investmentAmount) : null,
          probability: probability ? Number(probability) : null,
          expectedCloseDate: expectedCloseDate || null,
          notes: notes || null,
          owningAgentUserId,
          owningAiAgentId,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Deal created");
      qc.invalidateQueries({ queryKey: ["deals"] });
      navigate({ to: "/deals/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matchOk = !WORKSPACE_ENFORCEMENT_ENABLED || tenantMatchesActive;
  const canSubmit = !!(
    tenantId && dealName && startupId && investorId && owningAgentUserId && owningAiAgentId && matchOk
  );
  const noStartups = gate && !startupsQ.isLoading && startupOptions.length === 0;
  const noInvestors = gate && !investorsQ.isLoading && investorOptions.length === 0;
  const noAi = gate && !aisQ.isLoading && aiOptions.length === 0;
  const depsDisabled = !tenantId || (WORKSPACE_ENFORCEMENT_ENABLED && !tenantMatchesActive);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate({ selectedTenantId: tenantId, activeTenantId });
      }}
      className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-card"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Tenant *</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => {
                const fx = isFixtureTenant(t.tenantId);
                return (
                  <SelectItem key={t.tenantId} value={t.tenantId}>
                    <span className="flex items-center gap-2">
                      <span>{t.tenantName}</span>
                      {fx && (
                        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                          PREVIEW FIXTURE
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {WORKSPACE_ENFORCEMENT_ENABLED && tenantId && !tenantMatchesActive && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <p>
                {activeTenantId === null
                  ? "No active workspace. Switch to the target tenant workspace before creating a deal."
                  : `This tenant is not your active workspace. Switch workspace to ${activeTenantName ?? "the active tenant"} — or activate ${selectedTenantName ?? "the selected tenant"} — before continuing.`}
              </p>
              {isFixtureTenant(tenantId) ? (
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>
                    Switch to this tenant
                  </Button>
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                    Preview fixture — activation disabled (no backend call).
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={switchPending || !tenantId}
                    onClick={async () => {
                      setSwitchError(null);
                      setSwitchPending(true);
                      try {
                        await doSwitch({ data: { tenantId, workspaceType: "TENANT" } });
                        await qc.invalidateQueries({ queryKey: ["session-context"] });
                        await qc.invalidateQueries({ queryKey: ["assignable-tenants", principalRef] });
                      } catch (e) {
                        setSwitchError(mapSwitchError((e as Error).message ?? ""));
                      } finally {
                        setSwitchPending(false);
                      }
                    }}
                  >
                    {switchPending ? "Switching workspace…" : "Switch to this tenant"}
                  </Button>
                  {switchError && <span className="text-destructive">{switchError}</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Deal name *</Label>
          <Input value={dealName} onChange={(e) => setDealName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Startup *</Label>
          <Select value={startupId} onValueChange={setStartupId} disabled={depsDisabled || noStartups}>
            <SelectTrigger><SelectValue placeholder={startupsQ.isLoading ? "Loading…" : noStartups ? "No startups in this tenant" : "Select a startup"} /></SelectTrigger>
            <SelectContent>
              {startupOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.startup_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {noStartups && <p className="text-xs text-destructive">Create a startup in this tenant first.</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Investor *</Label>
          <Select value={investorId} onValueChange={setInvestorId} disabled={depsDisabled || noInvestors}>
            <SelectTrigger><SelectValue placeholder={investorsQ.isLoading ? "Loading…" : noInvestors ? "No investors in this tenant" : "Select an investor"} /></SelectTrigger>
            <SelectContent>
              {investorOptions.map((i) => <SelectItem key={i.id} value={i.id}>{i.investor_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {noInvestors && <p className="text-xs text-destructive">Create an investor in this tenant first.</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Stage</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DEAL_VISIBILITIES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Investment amount</Label>
          <Input type="number" min="0" step="0.01" value={investmentAmount} onChange={(e) => setAmount(e.target.value)} placeholder="250000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Probability (%)</Label>
          <Input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Expected close date</Label>
          <Input type="date" value={expectedCloseDate} onChange={(e) => setClose(e.target.value)} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={3} />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Ownership (required)</h3>
        <p className="mb-3 text-xs text-muted-foreground">Every deal must have one human Owning Agent and one Owning AI Agent.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Owning Agent *</Label>
            <Select value={owningAgentUserId} onValueChange={setOwningAgent} disabled={depsDisabled}>
              <SelectTrigger><SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} /></SelectTrigger>
              <SelectContent>
                {humanOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Owning AI Agent *</Label>
            <Select value={owningAiAgentId} onValueChange={setOwningAi} disabled={depsDisabled || noAi}>
              <SelectTrigger><SelectValue placeholder={aisQ.isLoading ? "Loading…" : noAi ? "No AI users in this tenant" : "Select an AI agent"} /></SelectTrigger>
              <SelectContent>
                {aiOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {noAi && <p className="text-xs text-destructive">Assign an AI user to this tenant first (Users → Invite, type AI).</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/deals" })}>Cancel</Button>
        <Button
          type="submit"
          disabled={!canSubmit || m.isPending}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {m.isPending ? "Creating…" : "Create deal"}
        </Button>
      </div>
    </form>
  );
}
