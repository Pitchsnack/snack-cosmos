import { Link } from "@tanstack/react-router";
import {
  ExternalLink, MapPin, Calendar, Linkedin, Rocket, Pencil, Loader2,
  Globe, Building2, TrendingUp, Layers, ShoppingCart, Users, UserCircle2,
  FileText,
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
  const mediaSlots = s.media.filter((m) => m.image_signed_url);
  const metaItems: { icon: typeof Calendar; label: React.ReactNode }[] = [];
  if (s.year_founded) metaItems.push({ icon: Calendar, label: `Est. ${s.year_founded}` });
  if (s.company_type) metaItems.push({ icon: Building2, label: s.company_type });
  if (s.headquarters) metaItems.push({ icon: MapPin, label: s.headquarters });
  if (s.investment_stage) metaItems.push({ icon: TrendingUp, label: s.investment_stage });

  return (
    <div className="space-y-8 text-foreground">
      {/* Header */}
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight leading-tight">{s.startup_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            {!compact && s.tenant_name && <span>{s.tenant_name}</span>}
            {!compact && s.tenant_name && (s.headquarters || s.industry?.length) && <span aria-hidden>·</span>}
            {s.headquarters && <span>{s.headquarters}</span>}
            {s.headquarters && s.industry?.length ? <span aria-hidden>·</span> : null}
            {s.industry?.length ? <span>{s.industry.join(" · ")}</span> : null}
          </div>
          <div className="mt-2">
            <GlobalStartupLineageBadge
              sourceGlobalId={(s as unknown as { source_global_id: string | null }).source_global_id}
              importedAt={(s as unknown as { imported_at: string | null }).imported_at}
            />
          </div>
        </div>
        {showEdit && canManage && (
          <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
            <Link to="/startups/$id/edit" params={{ id }}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Link>
          </Button>
        )}
      </header>

      {/* Media */}
      {mediaSlots.length > 0 && (
        <div className={`grid gap-3 ${mediaSlots.length === 1 ? "grid-cols-1" : mediaSlots.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {mediaSlots.map((m) => (
            <a
              key={m.slot}
              href={m.image_signed_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block aspect-video overflow-hidden rounded-lg bg-muted/40"
            >
              <img
                src={m.image_signed_url ?? ""}
                alt={m.caption ?? ""}
                className="h-full w-full object-cover transition duration-300 hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      {/* Short description */}
      {s.short_description && (
        <p className="text-[15px] leading-relaxed text-foreground/85">{s.short_description}</p>
      )}

      {/* Meta grid */}
      {(metaItems.length > 0 || s.email || s.website_url) && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {metaItems.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className="flex items-center gap-2 text-foreground/80">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>{m.label}</span>
              </div>
            );
          })}
          {s.website_url && (
            <a
              href={s.website_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-accent hover:underline"
            >
              <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Company URL <span aria-hidden>→</span></span>
            </a>
          )}
          {s.email && (
            <a
              href={`mailto:${s.email}`}
              className="flex items-center gap-2 text-accent hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{s.email}</span>
            </a>
          )}
        </dl>
      )}

      {/* Long description */}
      {s.long_description && (
        <Section icon={FileText} title="Product overview">
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground/85">
            {s.long_description}
          </p>
        </Section>
      )}

      {/* Product tags */}
      {s.product_tags.length > 0 && (
        <Section icon={Layers} title="Product & service tags">
          <ChipRow tags={s.product_tags} tone="primary" />
        </Section>
      )}

      {/* Market tags */}
      {s.market_tags.length > 0 && (
        <Section icon={ShoppingCart} title="Market tags">
          <ChipRow tags={s.market_tags} tone="muted" />
        </Section>
      )}

      {/* Founders */}
      {s.founders.length > 0 && (
        <Section icon={UserCircle2} title={`Founder${s.founders.length > 1 ? `s (${s.founders.length})` : ""}`}>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.founders.map((f) => (
              <div key={f.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-xs font-semibold text-muted-foreground">
                  {f.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{f.full_name}</div>
                  {f.position && (
                    <div className="text-xs text-muted-foreground mt-0.5">{f.position}</div>
                  )}
                  {f.bio && <p className="mt-1 text-xs text-foreground/75 leading-relaxed">{f.bio}</p>}
                  {f.linkedin_url && (
                    <a
                      href={f.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      <Linkedin className="h-3 w-3" strokeWidth={1.75} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Investors */}
      {s.investors.length > 0 && (
        <Section icon={Users} title={`Investor${s.investors.length > 1 ? `s (${s.investors.length})` : ""}`}>
          <div className="flex flex-wrap gap-2">
            {s.investors.map((i) => (
              <Link
                key={i.id}
                to="/investors/$id"
                params={{ id: i.investor_id }}
                className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground/85 transition hover:border-accent/40 hover:text-foreground"
              >
                {i.investor_name}
              </Link>
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

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-5">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const base = tone === "primary"
    ? "bg-primary/5 text-foreground/85 border-primary/20"
    : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${base}`}>{t}</span>
      ))}
    </div>
  );
}
