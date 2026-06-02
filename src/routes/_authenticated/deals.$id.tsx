import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
import { DealOwnershipCard } from "@/components/deals/deal-ownership-card";
import { DealDocumentsCard } from "@/components/deals/deal-documents-card";
import { useDeal, useDealActivity, useDealAuditLogs } from "@/hooks/use-deal";
import { updateDeal, archiveDeal, DEAL_STAGES, DEAL_VISIBILITIES } from "@/lib/deals.functions";
import { usePermissions } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  head: () => ({ meta: [{ title: `Deal — SnackPortal2` }] }),
  component: DealDetailPage,
});

function DealDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useDeal(id);
  const { has, isControl } = usePermissions();
  const qc = useQueryClient();
  const update = useServerFn(updateDeal);
  const archive = useServerFn(archiveDeal);

  const stageM = useMutation({
    mutationFn: (stage: string) => update({ data: { id, stage: stage as never } }),
    onSuccess: () => { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["deal", id] }); qc.invalidateQueries({ queryKey: ["deals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const visM = useMutation({
    mutationFn: (visibility: string) => update({ data: { id, visibility: visibility as never } }),
    onSuccess: () => { toast.success("Visibility updated"); qc.invalidateQueries({ queryKey: ["deal", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: () => archive({ data: { id } }),
    onSuccess: () => { toast.success("Archived"); qc.invalidateQueries({ queryKey: ["deal", id] }); qc.invalidateQueries({ queryKey: ["deals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="text-sm text-destructive">Failed to load: {(error as Error)?.message ?? "Not found"}</div>;

  const d = data as typeof data & {
    tenants: { tenant_name: string };
    startups: { id: string; startup_name: string };
    investors: { id: string; investor_name: string };
    deal_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null; assigned_at: string }>;
    deal_ai_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null; assigned_at: string }>;
    deal_documents: Array<{ id: string; file_name: string; file_url: string; document_type: string | null; created_at: string }>;
  };

  const owner = d.deal_ownership?.[0]?.users ?? null;
  const aiOwner = d.deal_ai_ownership?.[0]?.users ?? null;
  const canManage = isControl || has("deals.write");

  return (
    <div className="space-y-6">
      <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to deals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{d.tenants.tenant_name}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{d.deal_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link to="/startups/$id" params={{ id: d.startups.id }} className="hover:underline">{d.startups.startup_name}</Link>
            <span>↔</span>
            <Link to="/investors/$id" params={{ id: d.investors.id }} className="hover:underline">{d.investors.investor_name}</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{d.stage}</Badge>
          <Badge variant="outline">{d.visibility}</Badge>
          {canManage && d.visibility !== "Archived" && (
            <Button size="sm" variant="outline" onClick={() => archiveM.mutate()} disabled={archiveM.isPending}>Archive</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Investment amount" value={d.investment_amount != null ? `$${Number(d.investment_amount).toLocaleString()}` : null} />
            <Field label="Probability" value={d.probability != null ? `${d.probability}%` : null} />
            <Field label="Expected close" value={d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : null} />
            <Field label="Tenant" value={d.tenants.tenant_name} />
            <Field label="Created" value={new Date(d.created_at).toLocaleString()} />
            <Field label="Updated" value={new Date(d.updated_at).toLocaleString()} />
          </div>
          {d.notes && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{d.notes}</p>
            </div>
          )}
          {canManage && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</div>
                <div className="mt-2">
                  <Select value={d.stage} onValueChange={(v) => stageM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEAL_STAGES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</div>
                <div className="mt-2">
                  <Select value={d.visibility} onValueChange={(v) => visM.mutate(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEAL_VISIBILITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ownership" className="pt-4">
          <DealOwnershipCard dealId={id} tenantId={d.tenant_id} owner={owner} aiOwner={aiOwner} />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <DealDocumentsCard dealId={id} documents={d.deal_documents ?? []} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <ActivityList dealId={id} />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <AuditList dealId={id} />
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

function ActivityList({ dealId }: { dealId: string }) {
  const { data, isLoading } = useDealActivity(dealId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
      {data.map((a: { id: string; activity_type: string; activity_details: unknown; created_at: string }) => (
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

function AuditList({ dealId }: { dealId: string }) {
  const { data, isLoading } = useDealAuditLogs(dealId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
      {data.map((a: { id: string; action: string; new_value: unknown; created_at: string }) => (
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
