import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InvestorOwnershipCard } from "@/components/investors/investor-ownership-card";
import { InvestorUsersCard } from "@/components/investors/investor-users-card";
import { InvestorNotFound } from "@/components/investors/investor-not-found";
import { useInvestor, useInvestorActivity, useInvestorAuditLogs } from "@/hooks/use-investor";
import { updateInvestor, archiveInvestor } from "@/lib/investors.functions";
import { usePermissions } from "@/hooks/use-session-context";
import { isUuid } from "@/lib/uuid";

export const Route = createFileRoute("/_authenticated/investors/$id/")({
  head: () => ({ meta: [{ title: `Investor — SnackPortal2` }] }),
  component: InvestorDetailPage,
});

const STATUSES = ["Prospect","Active","Engaged","Investing","Inactive","Archived"];
const VISIBILITIES = ["Private","Tenant","Shared","Archived"];

function InvestorDetailPage() {
  const { id } = Route.useParams();
  const validId = isUuid(id);
  const { data, isLoading, error } = useInvestor(validId ? id : undefined);
  const { has, isControl } = usePermissions();
  const qc = useQueryClient();
  const update = useServerFn(updateInvestor);
  const archive = useServerFn(archiveInvestor);

  const statusM = useMutation({
    mutationFn: (status: string) => update({ data: { id, status: status as never } }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["investor", id] }); qc.invalidateQueries({ queryKey: ["investors"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const visM = useMutation({
    mutationFn: (visibility: string) => update({ data: { id, visibility: visibility as never } }),
    onSuccess: () => { toast.success("Visibility updated"); qc.invalidateQueries({ queryKey: ["investor", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: () => archive({ data: { id } }),
    onSuccess: () => { toast.success("Archived"); qc.invalidateQueries({ queryKey: ["investor", id] }); qc.invalidateQueries({ queryKey: ["investors"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!validId) return <InvestorNotFound reason="invalid" />;
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <InvestorNotFound reason="missing" />;

  const s = data as typeof data & {
    tenants: { tenant_name: string };
    investor_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null; assigned_at: string }>;
    investor_ai_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null; assigned_at: string }>;
    investor_users: Array<{ id: string; user_id: string; role: string | null; created_at: string; users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
  };

  const owner = s.investor_ownership?.[0]?.users ?? null;
  const aiOwner = s.investor_ai_ownership?.[0]?.users ?? null;
  const canManage = isControl || has("users.assign_role");

  return (
    <div className="space-y-6">
      <Link to="/investors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to investors
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {(s as unknown as { logo_signed_url: string | null }).logo_signed_url && (
            <img
              src={(s as unknown as { logo_signed_url: string }).logo_signed_url}
              alt=""
              className="h-16 w-16 rounded-lg border border-border object-contain bg-muted/30"
            />
          )}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.tenants.tenant_name}</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{s.investor_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {s.country && <span>{s.country}</span>}
              {s.investor_type && <><span>·</span><span>{s.investor_type}</span></>}
              {s.website_url && <><span>·</span><a href={s.website_url} target="_blank" rel="noreferrer" className="hover:underline">{s.website_url}</a></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{s.status}</Badge>
          <Badge variant="outline">{s.visibility}</Badge>
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link to="/investors/$id/edit" params={{ id }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
          )}
          {canManage && s.status !== "Archived" && (
            <Button size="sm" variant="outline" onClick={() => archiveM.mutate()} disabled={archiveM.isPending}>Archive</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Legal name" value={s.legal_name} />
            <Field label="Country" value={s.country} />
            <Field label="Type" value={s.investor_type} />
            <Field label="AUM" value={s.aum} />
            <Field label="Ticket size" value={s.ticket_size} />
            <Field label="Tenant" value={s.tenants.tenant_name} />
            <Field label="Created" value={new Date(s.created_at).toLocaleString()} />
            <Field label="Updated" value={new Date(s.updated_at).toLocaleString()} />
          </div>
          {s.short_description && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
              <p className="mt-2 text-sm">{s.short_description}</p>
            </div>
          )}

          {portfolioStartups.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Portfolio startups ({portfolioStartups.length})
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {portfolioStartups.map((p) => (
                  <CompanyEntityPill
                    key={p.id}
                    to="/startups/$id"
                    id={p.id}
                    name={p.startup_name}
                    logoUrl={p.logo_signed_url}
                  />
                ))}
              </div>
            </div>
          )}

          {portfolioInvestors.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Portfolio investors ({portfolioInvestors.length})
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {portfolioInvestors.map((p) => (
                  <CompanyEntityPill
                    key={p.id}
                    to="/investors/$id"
                    id={p.id}
                    name={p.investor_name}
                    logoUrl={p.logo_signed_url}
                  />
                ))}
              </div>
            </div>
          )}
          {canManage && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
                <div className="mt-2">
                  <Select value={s.status} onValueChange={(v) => statusM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</div>
                <div className="mt-2">
                  <Select value={s.visibility} onValueChange={(v) => visM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VISIBILITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ownership" className="pt-4">
          <InvestorOwnershipCard investorId={id} tenantId={s.tenant_id} owner={owner} aiOwner={aiOwner} />
        </TabsContent>

        <TabsContent value="users" className="pt-4">
          <InvestorUsersCard investorId={id} tenantId={s.tenant_id} assignments={s.investor_users ?? []} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <ActivityList investorId={id} />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <AuditList investorId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value || "—"}</div>
    </div>
  );
}

function ActivityList({ investorId }: { investorId: string }) {
  const { data, isLoading } = useInvestorActivity(investorId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
      {data.map((a: any) => (
        <div key={a.id} className="flex items-start justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">{a.activity_type}</div>
            <div className="text-xs text-muted-foreground">{JSON.stringify(a.activity_details)}</div>
          </div>
          <div className="whitespace-nowrap text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function AuditList({ investorId }: { investorId: string }) {
  const { data, isLoading } = useInvestorAuditLogs(investorId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
      {data.map((a: any) => (
        <div key={a.id} className="flex items-start justify-between gap-4 p-4">
          <div>
            <div className="text-sm font-medium">{a.action}</div>
            <div className="text-xs text-muted-foreground">{JSON.stringify(a.new_value)}</div>
          </div>
          <div className="whitespace-nowrap text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
