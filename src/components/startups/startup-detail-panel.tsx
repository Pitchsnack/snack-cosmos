import { Link } from "@tanstack/react-router";
import {
  ExternalLink, Mail, MapPin, Calendar, Linkedin, Rocket, Pencil, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStartup } from "@/hooks/use-startup";
import { usePermissions } from "@/hooks/use-session-context";
import { GlobalStartupLineageBadge } from "@/components/global-startups/global-startup-lineage-badge";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function StartupDetailPanel({
  id,
  showEdit = true,
  compact = false,
}: {
  id: string;
  showEdit?: boolean;
  compact?: boolean;
}) {
  const { data, isLoading, error } = useStartup(id);
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading startup…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Failed to load: {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const s = data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex flex-1 min-w-0 items-start gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
            {s.logo_signed_url ? (
              <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {!compact && (
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.tenant_name}</div>
            )}
            <h2 className="text-xl font-semibold tracking-tight">{s.startup_name}</h2>
            {s.company_type && <div className="text-xs text-muted-foreground">{s.company_type}</div>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {s.headquarters && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{s.headquarters}</span>}
              {s.year_founded && <span className="inline-flex items-center gap-0.5"><Calendar className="h-3 w-3" />Founded {s.year_founded}</span>}
              {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-0.5 hover:text-foreground"><Mail className="h-3 w-3" />{s.email}</a>}
              {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground"><ExternalLink className="h-3 w-3" />{s.website_url.replace(/^https?:\/\//,'')}</a>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.investment_stage && <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">{s.investment_stage}</Badge>}
              {s.industry?.map((ind) => <Badge key={ind} variant="outline" className="text-[10px]">{ind}</Badge>)}
              <GlobalStartupLineageBadge
                sourceGlobalId={(s as unknown as { source_global_id: string | null }).source_global_id}
                importedAt={(s as unknown as { imported_at: string | null }).imported_at}
              />
            </div>
          </div>
        </div>
        {showEdit && canManage && (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/startups/$id/edit" params={{ id }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Media slots 1/2/3 */}
      {s.media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((slot) => {
            const m = s.media.find((x) => x.slot === slot);
            return (
              <a
                key={slot}
                href={m?.image_signed_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!m?.image_signed_url) e.preventDefault(); }}
                className="block aspect-video overflow-hidden rounded-lg border border-border bg-muted/30"
              >
                {m?.image_signed_url ? (
                  <img src={m.image_signed_url} alt={m.caption ?? ""} className="h-full w-full object-cover transition hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">Slot {slot}</div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* About */}
      {(s.short_description || s.long_description) && (
        <Section title="About">
          {s.short_description && <p className="text-sm">{s.short_description}</p>}
          {s.long_description && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.long_description}</p>}
        </Section>
      )}

      {/* Tags */}
      {(s.product_tags.length > 0 || s.market_tags.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
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

      {/* Investors */}
      {s.investors.length > 0 && (
        <Section title="Investors">
          <div className="flex flex-wrap gap-2">
            {s.investors.map((i) => (
              <Link
                key={i.id}
                to="/investors/$id"
                params={{ id: i.investor_id }}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-accent/40 hover:bg-accent/5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                  {monogram(i.investor_name)}
                </div>
                <span className="font-medium">{i.investor_name}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Founders */}
      {s.founders.length > 0 && (
        <Section title="Founding & leadership team">
          <div className="grid gap-3 sm:grid-cols-2">
            {s.founders.map((f) => (
              <div key={f.id} className="rounded-md border border-border bg-background p-3">
                <div className="text-sm font-medium">{f.full_name}</div>
                {f.position && <div className="text-xs text-muted-foreground">{f.position}</div>}
                {f.bio && <p className="mt-1.5 text-xs">{f.bio}</p>}
                {f.linkedin_url && (
                  <a href={f.linkedin_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                    <Linkedin className="h-3 w-3" /> LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function StartupDetailEmpty() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <Rocket className="mb-2 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">Select a startup</p>
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

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const base = tone === "primary"
    ? "bg-primary/10 text-primary border-primary/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${base}`}>{t}</span>
      ))}
    </div>
  );
}
