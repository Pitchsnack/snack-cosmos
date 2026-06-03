import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { PermissionGuard } from "@/components/permission-guard";
import { useSharedDeal, useShareActivity, useDealIntroductions } from "@/hooks/use-shared-deal";
import { respondToShare, withdrawShare } from "@/lib/deal-shares.functions";
import { IntroductionDialog } from "@/components/deals/introduction-dialog";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/shared-deals/$id")({
  head: () => ({ meta: [{ title: "Shared Deal — SnackPortal2" }] }),
  component: SharedDealDetailPage,
});

function SharedDealDetailPage() {
  return (
    <PermissionGuard permission="deals.share.read">
      <SharedDealDetailInner />
    </PermissionGuard>
  );
}

function SharedDealDetailInner() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useSharedDeal(id);
  const { isControl } = usePermissions();
  const { data: session } = useSessionContext();
  const qc = useQueryClient();
  const respond = useServerFn(respondToShare);
  const withdraw = useServerFn(withdrawShare);

  const respondM = useMutation({
    mutationFn: (vars: { targetId: string; response: "Accepted" | "Rejected" }) =>
      respond({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Share ${vars.response.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["shared-deal", id] });
      qc.invalidateQueries({ queryKey: ["shared-deals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawM = useMutation({
    mutationFn: () => withdraw({ data: { shareId: id } }),
    onSuccess: () => {
      toast.success("Share withdrawn");
      qc.invalidateQueries({ queryKey: ["shared-deal", id] });
      qc.invalidateQueries({ queryKey: ["shared-deals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="text-sm text-destructive">Failed to load: {(error as Error)?.message ?? "Not found"}</div>;

  type Row = typeof data & {
    tenants: { tenant_name: string } | null;
    users: { email: string; first_name: string | null; last_name: string | null } | null;
    deals: {
      id: string; tenant_id: string; deal_name: string; stage: string; visibility: string;
      investment_amount: number | null; probability: number | null;
      expected_close_date: string | null; notes: string | null;
      startups: { id: string; startup_name: string; country: string | null; industry: string | null; short_description: string | null };
      investors: { id: string; investor_name: string; country: string | null; investor_type: string | null; short_description: string | null };
    };
    deal_share_targets: Array<{ id: string; target_tenant_id: string; status: string; target_tenant: { tenant_name: string } | null }>;
  };
  const r = data as Row;

  const activeTenant = session?.activeWorkspace.tenantId ?? null;
  const isOrigin = activeTenant === r.tenant_id || isControl;
  const myTargets = r.deal_share_targets.filter((t) => t.target_tenant_id === activeTenant);

  return (
    <div className="space-y-6">
      <Link to="/shared-deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to shared deals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" /> Read-only · Origin tenant: {r.tenants?.tenant_name ?? "—"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{r.deals.deal_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {r.deals.startups.startup_name} <span>↔</span> {r.deals.investors.investor_name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{r.deals.stage}</Badge>
          <Badge variant="outline">{r.status}</Badge>
        </div>
      </div>

      {/* Recipient actions */}
      {myTargets.length > 0 && !isOrigin && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your response</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {myTargets.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Badge variant="outline">{t.status}</Badge>
                <Button size="sm" variant="outline"
                  onClick={() => respondM.mutate({ targetId: t.id, response: "Accepted" })}
                  disabled={respondM.isPending || t.status === "Accepted"}>
                  Accept
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => respondM.mutate({ targetId: t.id, response: "Rejected" })}
                  disabled={respondM.isPending || t.status === "Rejected"}>
                  Reject
                </Button>
                <IntroductionDialog dealId={r.deals.id} dealName={r.deals.deal_name} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Origin actions */}
      {isOrigin && r.status !== "Withdrawn" && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Origin tenant actions</div>
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => withdrawM.mutate()} disabled={withdrawM.isPending}>
              Withdraw share
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="introduction">Introduction</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Stage" value={r.deals.stage} />
            <Field label="Visibility" value={r.deals.visibility} />
            <Field label="Expected close" value={r.deals.expected_close_date ? new Date(r.deals.expected_close_date).toLocaleDateString() : null} />
            <Field label="Investment" value={r.deals.investment_amount != null ? `$${Number(r.deals.investment_amount).toLocaleString()}` : null} />
            <Field label="Probability" value={r.deals.probability != null ? `${r.deals.probability}%` : null} />
            <Field label="Shared by" value={r.users?.email ?? null} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Startup">
              <div className="text-sm font-medium">{r.deals.startups.startup_name}</div>
              <div className="text-xs text-muted-foreground">{[r.deals.startups.industry, r.deals.startups.country].filter(Boolean).join(" · ")}</div>
              {r.deals.startups.short_description && <p className="mt-2 text-sm text-muted-foreground">{r.deals.startups.short_description}</p>}
            </Card>
            <Card title="Investor">
              <div className="text-sm font-medium">{r.deals.investors.investor_name}</div>
              <div className="text-xs text-muted-foreground">{[r.deals.investors.investor_type, r.deals.investors.country].filter(Boolean).join(" · ")}</div>
              {r.deals.investors.short_description && <p className="mt-2 text-sm text-muted-foreground">{r.deals.investors.short_description}</p>}
            </Card>
          </div>
          {r.share_reason && (
            <Card title="Share reason">
              <p className="text-sm whitespace-pre-wrap">{r.share_reason}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="introduction" className="pt-4">
          <IntroductionPanel dealId={r.deals.id} dealName={r.deals.deal_name} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <ActivityPanel shareId={id} />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <AuditTargets targets={r.deal_share_targets} />
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ActivityPanel({ shareId }: { shareId: string }) {
  const { data, isLoading } = useShareActivity(shareId);
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

function IntroductionPanel({ dealId, dealName }: { dealId: string; dealName: string }) {
  const { data, isLoading } = useDealIntroductions(dealId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Introductions tracked for this deal.</p>
        <IntroductionDialog dealId={dealId} dealName={dealName} />
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No introductions yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
          {data.map((i: { id: string; status: string; created_at: string }) => (
            <div key={i.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="text-sm font-medium">{i.status}</div>
              </div>
              <div className="whitespace-nowrap text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTargets({ targets }: { targets: Array<{ id: string; status: string; target_tenant: { tenant_name: string } | null }> }) {
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border shadow-card">
      {targets.map((t) => (
        <div key={t.id} className="flex items-center justify-between p-4">
          <div className="text-sm">{t.target_tenant?.tenant_name ?? "—"}</div>
          <Badge variant="outline">{t.status}</Badge>
        </div>
      ))}
    </div>
  );
}
