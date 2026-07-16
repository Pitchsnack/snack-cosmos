import { Link } from "@tanstack/react-router";
import { ExternalLink, MapPin, Briefcase, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInvestor } from "@/hooks/use-investor";
import { usePermissions } from "@/hooks/use-session-context";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function InvestorDetailPanel({
  id,
  showEdit = false,
  compact = false,
}: {
  id: string;
  showEdit?: boolean;
  compact?: boolean;
}) {
  const { data, isLoading, error } = useInvestor(id);
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("investors.write");

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Failed to load: {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const i = data as typeof data & {
    tenants?: { tenant_name: string };
    linked_startups?: Array<{ id: string; startup_name: string; logo_signed_url: string | null }>;
  };
  const linked = i.linked_startups ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex flex-1 min-w-0 items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            <span className="text-base font-semibold text-muted-foreground">{monogram(i.investor_name)}</span>
          </div>
          <div className="min-w-0 flex-1">
            {!compact && i.tenants?.tenant_name && (
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{i.tenants.tenant_name}</div>
            )}
            <h2 className="text-xl font-semibold tracking-tight">{i.investor_name}</h2>
            {i.investor_type && <div className="text-xs text-muted-foreground">{i.investor_type}</div>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {i.country && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{i.country}</span>}
              {i.website_url && (
                <a href={i.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                  <ExternalLink className="h-3 w-3" />{i.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}
              {i.linkedin_url && (
                <a href={i.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                  <ExternalLink className="h-3 w-3" />LinkedIn
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {i.status && <Badge variant="outline" className="text-[10px]">{i.status}</Badge>}
              {i.visibility && <Badge variant="outline" className="text-[10px]">{i.visibility}</Badge>}
            </div>
          </div>
        </div>
        {showEdit && canManage && (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/investors/$id" params={{ id }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Manage
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Description */}
      {(i.short_description || i.long_description) && (
        <Section title="About">
          {i.short_description && <p className="text-sm">{i.short_description}</p>}
          {i.long_description && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{i.long_description}</p>
          )}
        </Section>
      )}

      {/* Investment focus */}
      {(i.aum || i.ticket_size || i.investor_type) && (
        <Section title="Investment focus">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type" value={i.investor_type} />
            <Field label="AUM" value={i.aum} />
            <Field label="Ticket size" value={i.ticket_size} />
          </div>
        </Section>
      )}

      {/* Portfolio / linked startups */}
      <Section title={`Portfolio startups${linked.length > 0 ? ` (${linked.length})` : ""}`}>
        {linked.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> No startups linked yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {linked.map((s) => (
              <Link
                key={s.id}
                to="/startups/$id"
                params={{ id: s.id }}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/40 hover:bg-accent/5"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                  {s.logo_signed_url ? (
                    <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    monogram(s.startup_name)
                  )}
                </div>
                <span className="font-medium">{s.startup_name}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export function InvestorDetailEmpty() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <Briefcase className="mb-2 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">Select an investor</p>
      <p className="mt-1 text-xs text-muted-foreground">Pick a card on the left to see its intelligence here.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value || "—"}</div>
    </div>
  );
}
