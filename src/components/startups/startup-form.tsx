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
import { createStartup } from "@/lib/startups.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useHasSession } from "@/hooks/use-has-session";

const STATUSES = ["Draft","Active","Fundraising","Due Diligence","Portfolio","Exited","Inactive","Archived"];
const VISIBILITIES = ["Private","Tenant","Shared","Archived"];

export function StartupForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const create = useServerFn(createStartup);
  const fetchUsers = useServerFn(listAssignableUsers);
  const enabled = useHasSession();

  const tenants = useMemo(() => session?.tenants ?? [], [session]);
  const [tenantId, setTenantId] = useState<string>("");

  useEffect(() => {
    if (!tenantId && tenants.length) setTenantId(session?.activeWorkspace.tenantId ?? tenants[0].tenantId);
  }, [tenants, tenantId, session]);

  const [startupName, setStartupName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [status, setStatus] = useState("Draft");
  const [visibility, setVisibility] = useState("Tenant");
  const [owningAgentUserId, setOwningAgent] = useState("");
  const [owningAiAgentId, setOwningAi] = useState("");

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
          startupName,
          legalName: legalName || null,
          websiteUrl: websiteUrl || null,
          country: country || null,
          industry: industry || null,
          shortDescription: shortDescription || null,
          status: status as never,
          visibility: visibility as never,
          owningAgentUserId,
          owningAiAgentId,
        },
      }),
    onSuccess: (res) => {
      toast.success("Startup created");
      qc.invalidateQueries({ queryKey: ["startups"] });
      navigate({ to: "/startups/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = tenantId && startupName && owningAgentUserId && owningAiAgentId;
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
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Startup name *</Label>
          <Input value={startupName} onChange={(e) => setStartupName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Legal name</Label>
          <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Website</Label>
          <Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Industry</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VISIBILITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wide">Short description</Label>
          <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={500} rows={3} />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Ownership (required)</h3>
        <p className="mb-3 text-xs text-muted-foreground">Every startup must have one human Owning Agent and one Owning AI Agent.</p>
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
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/startups" })}>Cancel</Button>
        <Button
          type="submit"
          disabled={!canSubmit || m.isPending}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {m.isPending ? "Creating…" : "Create startup"}
        </Button>
      </div>
    </form>
  );
}
