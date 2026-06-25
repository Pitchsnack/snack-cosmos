import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Mail, MapPin, Calendar, Pencil, Linkedin } from "lucide-react";
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
import { StartupOwnershipCard } from "@/components/startups/startup-ownership-card";
import { StartupUsersCard } from "@/components/startups/startup-users-card";
import { GlobalStartupLineageBadge } from "@/components/global-startups/global-startup-lineage-badge";
import { useStartup, useStartupActivity, useStartupAuditLogs } from "@/hooks/use-startup";
import { updateStartup, archiveStartup, type StartupDetail } from "@/lib/startups.functions";
import { usePermissions } from "@/hooks/use-session-context";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/startups/$id/")({
  head: () => ({ meta: [{ title: "Startup — SnackPortal2" }] }),
  component: StartupDetailPage,
});

const STATUSES = ["Draft","Active","Fundraising","Due Diligence","Portfolio","Exited","Inactive","Archived"];
const VISIBILITIES = ["Private","Tenant","Shared","Archived"];

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function StartupDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const validId = isUuid(id);
  const { data, isLoading, error } = useStartup(validId ? id : undefined);
  const { has, isControl } = usePermissions();
  const qc = useQueryClient();
  const update = useServerFn(updateStartup);
  const archive = useServerFn(archiveStartup);

  const statusM = useMutation({
    mutationFn: (status: string) => update({ data: { id, status: status as never } }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["startup", id] }); qc.invalidateQueries({ queryKey: ["startups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const visM = useMutation({
    mutationFn: (visibility: string) => update({ data: { id, visibility: visibility as never } }),
    onSuccess: () => { toast.success("Visibility updated"); qc.invalidateQueries({ queryKey: ["startup", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveM = useMutation({
    mutationFn: () => archive({ data: { id } }),
    onSuccess: () => { toast.success("Archived"); qc.invalidateQueries({ queryKey: ["startup", id] }); qc.invalidateQueries({ queryKey: ["startups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!validId) return <StartupNotFound reason="invalid" />;
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <StartupNotFound reason="missing" />;

  const s = data as StartupDetail & {
    startup_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
    startup_ai_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
    startup_users: Array<{ id: string; user_id: string; role: string | null; created_at: string; users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
  };

  const owner = s.startup_ownership?.[0]?.users ?? null;
  const aiOwner = s.startup_ai_ownership?.[0]?.users ?? null;
  const canManage = isControl || has("users.assign_role") || has("startups.write");

  return (
    <div className="space-y-6">
      <Link to="/startups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to startups
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-1 min-w-0 items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {s.logo_signed_url ? (
              <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.tenant_name}</div>
            <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">{s.startup_name}</h1>
            {s.company_type && <div className="text-sm text-muted-foreground">{s.company_type}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {s.headquarters && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.headquarters}</span>}
              {s.year_founded && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Founded {s.year_founded}</span>}
              {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{s.email}</a>}
              {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" />{s.website_url.replace(/^https?:\/\//,'')}</a>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.investment_stage && <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">{s.investment_stage}</Badge>}
              {s.industry && <Badge variant="outline">{s.industry}</Badge>}
              <Badge variant="outline">{s.status}</Badge>
              <Badge variant="outline">{s.visibility}</Badge>
              <GlobalStartupLineageBadge
                sourceGlobalId={s.source_global_id}
                importedAt={s.imported_at}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/startups/$id/edit", params: { id } })}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
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

        <TabsContent value="overview" className="space-y-6 pt-4">
          {s.media.length > 0 && (
            <Section title="Media">
              <div className="grid gap-3 md:grid-cols-3">
                {s.media.map((m) => (
                  <a key={m.id} href={m.image_signed_url ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-muted/30 aspect-video">
                    {m.image_signed_url && <img src={m.image_signed_url} alt={m.caption ?? ""} className="h-full w-full object-cover transition hover:scale-105" />}
                  </a>
                ))}
              </div>
            </Section>
          )}

          {(s.short_description || s.long_description) && (
            <Section title="About">
              {s.short_description && <p className="text-sm">{s.short_description}</p>}
              {s.long_description && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.long_description}</p>}
            </Section>
          )}

          {(s.product_tags.length > 0 || s.market_tags.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {s.product_tags.length > 0 && (
                <Section title="Product & service tags">
                  <ChipRow tags={s.product_tags} tone="primary" />
                </Section>
              )}
              {s.market_tags.length > 0 && (
                <Section title="Market tags">
                  <ChipRow tags={s.market_tags} tone="muted" />
                </Section>
              )}
            </div>
          )}

          <Section title="Investors">
            {s.investors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No investors linked yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {s.investors.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">{monogram(i.investor_name)}</div>
                    <span className="text-sm font-medium">{i.investor_name}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Founding & leadership team">
            {s.founders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No founders added yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {s.founders.map((f) => (
                  <div key={f.id} className="rounded-md border border-border bg-background p-4">
                    <div className="font-medium">{f.full_name}</div>
                    {f.position && <div className="text-xs text-muted-foreground">{f.position}</div>}
                    {f.bio && <p className="mt-2 text-sm">{f.bio}</p>}
                    {f.linkedin_url && (
                      <a href={f.linkedin_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        <Linkedin className="h-3 w-3" /> LinkedIn
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {canManage && (
            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Status">
                <Select value={s.status} onValueChange={(v) => statusM.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </Section>
              <Section title="Visibility">
                <Select value={s.visibility} onValueChange={(v) => visM.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISIBILITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </Section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ownership" className="pt-4">
          <StartupOwnershipCard startupId={id} tenantId={s.tenant_id} owner={owner} aiOwner={aiOwner} />
        </TabsContent>

        <TabsContent value="users" className="pt-4">
          <StartupUsersCard startupId={id} tenantId={s.tenant_id} assignments={s.startup_users ?? []} />
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <ActivityList startupId={id} />
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <AuditList startupId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const base = tone === "primary" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${base}`}>{t}</span>
      ))}
    </div>
  );
}

function ActivityList({ startupId }: { startupId: string }) {
  const { data, isLoading } = useStartupActivity(startupId);
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

function AuditList({ startupId }: { startupId: string }) {
  const { data, isLoading } = useStartupAuditLogs(startupId);
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