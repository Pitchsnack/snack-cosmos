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
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";

export function DealForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createDeal);
  const fetchUsers = useServerFn(listAssignableUsers);
  const fetchStartups = useServerFn(listStartupOptions);
  const fetchInvestors = useServerFn(listInvestorOptions);
  const enabled = useHasSession();

  const tenants = useMemo(() => session?.tenants ?? [], [session]);
  const [tenantId, setTenantId] = useState<string>("");

  useEffect(() => {
    if (!tenantId && tenants.length) setTenantId(session?.activeWorkspace.tenantId ?? tenants[0].tenantId);
  }, [tenants, tenantId, session]);

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

  const startupsQ = useQuery({
    queryKey: ["deal-startups", tenantId],
    queryFn: () => fetchStartups({ data: { tenantId } }),
    enabled: enabled && !!tenantId,
  });
  const investorsQ = useQuery({
    queryKey: ["deal-investors", tenantId],
    queryFn: () => fetchInvestors({ data: { tenantId } }),
    enabled: enabled && !!tenantId,
  });
  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && !!tenantId,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: enabled && !!tenantId,
  });

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          tenantId,
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
      }),
    onSuccess: (res) => {
      toast.success("Deal created");
      qc.invalidateQueries({ queryKey: ["deals"] });
      navigate({ to: "/deals/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = tenantId && dealName && startupId && investorId && owningAgentUserId && owningAiAgentId;
  const noStartups = !startupsQ.isLoading && (startupsQ.data ?? []).length === 0;
  const noInvestors = !investorsQ.isLoading && (investorsQ.data ?? []).length === 0;
  const noAi = !aisQ.isLoading && (aisQ.data ?? []).length === 0;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-card"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Tenant *</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => <SelectItem key={t.tenantId} value={t.tenantId}>{t.tenantName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Deal name *</Label>
          <Input value={dealName} onChange={(e) => setDealName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Startup *</Label>
          <Select value={startupId} onValueChange={setStartupId} disabled={!tenantId || noStartups}>
            <SelectTrigger><SelectValue placeholder={startupsQ.isLoading ? "Loading…" : noStartups ? "No startups in this tenant" : "Select a startup"} /></SelectTrigger>
            <SelectContent>
              {(startupsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.startup_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {noStartups && <p className="text-xs text-destructive">Create a startup in this tenant first.</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Investor *</Label>
          <Select value={investorId} onValueChange={setInvestorId} disabled={!tenantId || noInvestors}>
            <SelectTrigger><SelectValue placeholder={investorsQ.isLoading ? "Loading…" : noInvestors ? "No investors in this tenant" : "Select an investor"} /></SelectTrigger>
            <SelectContent>
              {(investorsQ.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.investor_name}</SelectItem>)}
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
            <Select value={owningAgentUserId} onValueChange={setOwningAgent} disabled={!tenantId}>
              <SelectTrigger><SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} /></SelectTrigger>
              <SelectContent>
                {(humansQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Owning AI Agent *</Label>
            <Select value={owningAiAgentId} onValueChange={setOwningAi} disabled={!tenantId || noAi}>
              <SelectTrigger><SelectValue placeholder={aisQ.isLoading ? "Loading…" : noAi ? "No AI users in this tenant" : "Select an AI agent"} /></SelectTrigger>
              <SelectContent>
                {(aisQ.data ?? []).map((u) => (
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
