import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, ExternalLink, Share2, X, MoreVertical, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";
import { ShareStartupDialog } from "@/components/startups/share-startup-dialog";
import type { StartupListItem } from "@/lib/startups.functions";
import { type SimilarityMode, similarTo } from "@/lib/similarity-map/similarity";
import { cn } from "@/lib/utils";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Pills({ items, tone }: { items: string[]; tone: "industry" | "product" | "market" }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Not provided</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            tone === "industry" && "border-success/30 bg-success/10 text-success",
            tone === "product" && "border-info/30 bg-info/10 text-info",
            tone === "market" && "border-accent/40 bg-accent/10 text-accent-foreground",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function MapInfoPanel({
  startup,
  rows,
  mode,
  threshold,
  onSelect,
  onClose,
}: {
  startup: StartupListItem;
  rows: StartupListItem[];
  mode: SimilarityMode;
  threshold: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [showAllSimilar, setShowAllSimilar] = useState(false);

  const similar = useMemo(
    () => similarTo(rows, startup.id, mode, Math.min(threshold, 0.01)),
    [rows, startup.id, mode, threshold],
  );
  const visibleSimilar = showAllSimilar ? similar : similar.slice(0, 4);
  const rest = similar.length - visibleSimilar.length;

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border/60 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
          {startup.logo_signed_url ? (
            <img src={startup.logo_signed_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {monogram(startup.startup_name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight">{startup.startup_name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {[startup.industry?.[0], startup.investment_stage].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {startup.headquarters ?? startup.city ?? "—"}
            {startup.website_url && (
              <a
                href={startup.website_url}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-2 inline-flex items-center gap-0.5 text-accent hover:underline"
              >
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <FavoriteToggle id={startup.id} size="md" className="h-8 w-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  navigator.clipboard?.writeText(
                    `${window.location.origin}/startups/${startup.id}`,
                  )
                }
              >
                <Copy className="mr-2 h-4 w-4" /> Copy Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 justify-start bg-muted/40">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="investors">Investors</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="overview" className="mt-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              {startup.short_description ?? "No description available."}
            </p>

            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold">Industry</h4>
              <Pills items={startup.industry ?? []} tone="industry" />
            </section>
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold">Product &amp; Service Tags</h4>
              <Pills items={startup.product_tags ?? []} tone="product" />
            </section>
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold">Market Tags</h4>
              <Pills items={startup.market_tags ?? []} tone="market" />
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Fact label="Founded" value={startup.year_founded ?? "—"} />
              <Fact label="Headquarters" value={startup.headquarters ?? startup.city ?? "—"} />
              <Fact label="Stage" value={startup.investment_stage ?? "—"} />
              <Fact label="Region" value={startup.region ?? "—"} />
            </div>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold">Similar Startups (current map mode)</h4>
              {visibleSimilar.length === 0 ? (
                <p className="text-xs text-muted-foreground">No similar startups found.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {visibleSimilar.map(({ startup: s, score }) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s.id)}
                      className="flex w-[78px] flex-col items-center gap-1 rounded-lg border border-border/60 bg-card px-1.5 py-2 text-center hover:border-accent/60"
                    >
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                        {s.logo_signed_url ? (
                          <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {monogram(s.startup_name)}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-[10px] font-medium leading-tight">
                        {s.startup_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(score * 100)}%
                      </span>
                    </button>
                  ))}
                  {rest > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSimilar(true)}
                      className="flex h-[74px] w-[52px] items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      +{rest} more
                    </button>
                  )}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="details" className="mt-0 space-y-2 text-sm">
            <Fact label="Company type" value={startup.company_type ?? "—"} />
            <Fact label="Website" value={startup.website_url ?? "—"} />
            <Fact label="Workspace" value={startup.tenant_name ?? "—"} />
            <p className="text-sm text-muted-foreground">
              {startup.long_description ?? "No additional details available."}
            </p>
          </TabsContent>

          <TabsContent value="team" className="mt-0">
            <p className="text-sm text-muted-foreground">
              Team information is available on the startup detail page.
            </p>
          </TabsContent>

          <TabsContent value="investors" className="mt-0 space-y-1.5">
            {startup.related_investors?.length ? (
              startup.related_investors.map((i) => (
                <p key={i.id} className="text-sm">
                  {i.name}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No linked investors.</p>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex items-center gap-2 border-t border-border/60 p-3">
        <Button asChild size="sm" className="flex-1">
          <Link to="/startups/$id" params={{ id: startup.id }}>
            View Details
          </Link>
        </Button>
        <FavoriteToggle id={startup.id} size="md" className="h-9 w-9 rounded-md border border-border" />
        <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
          <Share2 className="mr-1 h-3.5 w-3.5" /> Share
        </Button>
      </div>

      <ShareStartupDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        startup={{
          name: startup.startup_name,
          tagline: startup.short_description,
          location: startup.headquarters ?? startup.city,
          website: startup.website_url,
          logoUrl: startup.logo_signed_url,
        }}
      />

    </aside>
  );
}
