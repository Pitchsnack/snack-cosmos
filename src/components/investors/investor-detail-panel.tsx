import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { type InvestorDirectorySearch } from "@/routes/_authenticated/investors.index";
import {
  ExternalLink,
  MapPin,
  Calendar,
  Linkedin,
  Briefcase,
  Pencil,
  Loader2,
  Globe,
  Building2,
  Coins,
  Layers,
  Tag,
  FileText,
  MoreVertical,
  Copy,
  Activity,
  X,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";
import { useInvestor } from "@/hooks/use-investor";
import { usePermissions } from "@/hooks/use-session-context";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { ConnectionAction, ConnectionStateCard } from "@/components/startups/connection-action";
import { useConnectionState } from "@/hooks/use-connection-state";
import { cn } from "@/lib/utils";
import { CompanyEntityPill } from "@/components/relationships/company-entity-pill";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type InvestorDetail = {
  id: string;
  investor_name: string;
  investor_type: string | null;
  country: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  email?: string | null;
  firm_name?: string | null;
  business_address?: string | null;
  year_founded?: number | string | null;
  aum: string | null;
  ticket_size: string | null;
  min_ticket_size?: string | null;
  max_ticket_size?: string | null;
  short_description: string | null;
  long_description: string | null;
  bio?: string | null;
  investment_focus?: string | string[] | null;
  keywords?: string[] | null;
  preferred_stages?: string[] | null;
  preferred_industries?: string[] | null;
  status: string | null;
  visibility: string | null;
  logo_signed_url: string | null;
  tenants?: { tenant_name: string } | null;
  media?: Array<{ slot: number; image_signed_url: string | null }>;
  linked_startups?: Array<{ id: string; startup_name: string; logo_signed_url: string | null }>;
  portfolio_investors?: Array<{ id: string; investor_name: string; logo_signed_url: string | null }>;
};

export function InvestorDetailPanel({
  id,
  showEdit = true,
  compact = false,
  onClose,
  directorySearch,
  onSelectStartup,
  onSelectInvestor,
}: {
  id: string;
  showEdit?: boolean;
  compact?: boolean;
  onClose?: () => void;
  directorySearch?: InvestorDirectorySearch;
  /** When provided, portfolio chips open in-place instead of navigating away. */
  onSelectStartup?: (id: string) => void;
  onSelectInvestor?: (id: string) => void;
}) {
  const { data, isLoading, error } = useInvestor(id);
  const connectionState = useConnectionState(id);
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("investors.write");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const i = (data ?? null) as InvestorDetail | null;

  const portfolioSearch = directorySearch
    ? directorySearch.view === "split"
      ? { ...directorySearch, selected: i?.id ?? id }
      : { ...directorySearch, panel: i?.id ?? id }
    : undefined;

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const prev = el.style.webkitLineClamp;
    el.style.webkitLineClamp = "unset";
    const full = el.scrollHeight;
    el.style.webkitLineClamp = prev;
    setDescClamped(full > el.clientHeight + 1);
  }, [i?.long_description, i?.bio]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(`${window.location.origin}/investors/${id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading investor…</span>
      </div>
    );
  }
  if (error || !i) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Failed to load: {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const linked = i.linked_startups ?? [];
  const portfolioInvestors = i.portfolio_investors ?? [];
  const mediaSlots = (i.media ?? []).filter((m) => m.image_signed_url);
  const ticket =
    i.ticket_size || [i.min_ticket_size, i.max_ticket_size].filter(Boolean).join(" – ") || null;
  const overview = i.long_description || i.bio || null;

  const metaItems: { icon: typeof Calendar; label: React.ReactNode }[] = [];
  if (i.year_founded) metaItems.push({ icon: Calendar, label: `Est. ${i.year_founded}` });
  if (i.investor_type) metaItems.push({ icon: Building2, label: i.investor_type });
  if (i.country) metaItems.push({ icon: MapPin, label: i.country });
  if (i.aum) metaItems.push({ icon: Coins, label: `AUM ${i.aum}` });
  if (ticket) metaItems.push({ icon: Layers, label: `Ticket ${ticket}` });

  return (
    <div className="space-y-[14px] text-foreground">
      {/* Header */}
      <header className={cn("flex items-start justify-between gap-4", compact && "pt-1")}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
            {i.logo_signed_url ? (
              <img src={i.logo_signed_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {monogram(i.investor_name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight">
              {i.investor_name}
              {connectionState === "connected" && (
                <span
                  className="ml-2 inline-flex items-center align-middle text-emerald-600 dark:text-emerald-400"
                  title="Connected"
                  aria-label="Connected"
                >
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                </span>
              )}
              <PreviewNeedsReassignmentBadge
                name={i.investor_name}
                domain="investor"
                className="ml-2 align-middle"
              />
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              {!compact && i.tenants?.tenant_name && <span>{i.tenants.tenant_name}</span>}
              {!compact && i.tenants?.tenant_name && (i.country || i.investor_type) && (
                <span aria-hidden>·</span>
              )}
              {i.country && <span>{i.country}</span>}
              {i.country && i.investor_type ? <span aria-hidden>·</span> : null}
              {i.investor_type && <span>{i.investor_type}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {i.status && (
                <Badge variant="outline" className="text-[10px]">
                  {i.status}
                </Badge>
              )}
              {i.visibility && (
                <Badge variant="outline" className="text-[10px]">
                  {i.visibility}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {showEdit && canManage && !compact && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link to="/investors/$id/edit" params={{ id }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
          )}
          {compact && (
            <div className="flex items-center gap-1">
              <ConnectionAction startupRef={id} />
              <FavoriteToggle id={id} entity="investors" size="md" className="h-8 w-8" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </DropdownMenuItem>
                  {canManage ? (
                    <DropdownMenuItem asChild>
                      <Link to="/investors/$id/edit" params={{ id }} onClick={() => onClose?.()}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem disabled>
                    <Activity className="mr-2 h-4 w-4" /> View Activity / Audit
                    <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      {/* Relationship state (Connect → Requested → Share) */}
      <ConnectionStateCard
        startupRef={id}
        counterpartName={i.investor_name}
        counterpartRole={i.investor_type}
      />

      {connectionState === "requested" ? null : (
        <>
          {/* Media */}
          {mediaSlots.length > 0 && (
            <div
              className={cn(
                "grid gap-3",
                mediaSlots.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {mediaSlots.map((m) => {
                const single = mediaSlots.length === 1;
                return (
                  <button
                    key={m.slot}
                    type="button"
                    onClick={() => m.image_signed_url && setLightbox(m.image_signed_url)}
                    className={cn(
                      "block overflow-hidden rounded-lg bg-muted/40 text-left",
                      single ? "w-[48%] max-w-[50%]" : "aspect-video",
                    )}
                    style={single ? { aspectRatio: "64 / 25" } : undefined}
                  >
                    <img
                      src={m.image_signed_url ?? ""}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {lightbox &&
            typeof document !== "undefined" &&
            createPortal(
              <LightboxOverlay url={lightbox} onClose={() => setLightbox(null)} />,
              document.body,
            )}

          {/* Short description */}
          {i.short_description && (
            <p className="text-[15px] leading-relaxed text-foreground/85">{i.short_description}</p>
          )}

          {/* Meta grid */}
          {(metaItems.length > 0 || i.email || i.website_url || i.linkedin_url) && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {metaItems.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <div key={idx} className="flex items-center gap-2 text-foreground/80">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>{m.label}</span>
                  </div>
                );
              })}
              {i.website_url && (
                <a
                  href={i.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-accent hover:underline"
                >
                  <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">
                    Website <span aria-hidden>→</span>
                  </span>
                </a>
              )}
              {i.linkedin_url && (
                <a
                  href={i.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-accent hover:underline"
                >
                  <Linkedin className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">LinkedIn</span>
                </a>
              )}
              {i.email && (
                <a
                  href={`mailto:${i.email}`}
                  className="flex items-center gap-2 text-accent hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{i.email}</span>
                </a>
              )}
            </dl>
          )}

          {/* Overview */}
          {overview && (
            <Section icon={FileText} title="Investor overview">
              <p
                ref={descRef}
                className={cn(
                  "whitespace-pre-line text-[14px] leading-relaxed text-foreground/85",
                  !descExpanded && "line-clamp-4",
                )}
              >
                {overview}
              </p>
              {(descClamped || descExpanded) && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 text-[13px] font-medium text-primary hover:underline"
                >
                  {descExpanded ? "Less" : "More…"}
                </button>
              )}
            </Section>
          )}

          {/* Investment focus + Preferred stages */}
          {(() => {
            const focus = Array.isArray(i.investment_focus)
              ? i.investment_focus.filter(Boolean)
              : typeof i.investment_focus === "string" && i.investment_focus.trim()
                ? [i.investment_focus.trim()]
                : [];
            const stages = i.preferred_stages ?? [];
            const hasFocus = focus.length > 0;
            const hasStages = stages.length > 0;
            if (!hasFocus && !hasStages) return null;

            if (hasFocus && hasStages) {
              return (
                <PairedSection
                  left={{
                    icon: Layers,
                    title: "Investment focus",
                    content: <ChipRow tags={focus} tone="primary" />,
                  }}
                  right={{
                    icon: Layers,
                    title: "Preferred stages",
                    content: <ChipRow tags={stages} tone="primary" />,
                  }}
                />
              );
            }

            if (hasFocus) {
              return (
                <Section icon={Layers} title="Investment focus">
                  <ChipRow tags={focus} tone="primary" />
                </Section>
              );
            }

            return (
              <Section icon={Layers} title="Preferred stages">
                <ChipRow tags={stages} tone="primary" />
              </Section>
            );
          })()}

          {/* Preferred industries + Keywords */}
          {(() => {
            const industries = i.preferred_industries ?? [];
            const keywords = i.keywords ?? [];
            const hasIndustries = industries.length > 0;
            const hasKeywords = keywords.length > 0;
            if (!hasIndustries && !hasKeywords) return null;

            if (hasIndustries && hasKeywords) {
              return (
                <PairedSection
                  left={{
                    icon: Building2,
                    title: "Preferred industries",
                    content: <ChipRow tags={industries} tone="muted" />,
                  }}
                  right={{
                    icon: Tag,
                    title: "Keywords",
                    content: <ChipRow tags={keywords} tone="muted" />,
                  }}
                />
              );
            }

            if (hasIndustries) {
              return (
                <Section icon={Building2} title="Preferred industries">
                  <ChipRow tags={industries} tone="muted" />
                </Section>
              );
            }

            return (
              <Section icon={Tag} title="Keywords">
                <ChipRow tags={keywords} tone="muted" />
              </Section>
            );
          })()}

          {/* Portfolio startups */}
          <Section
            icon={Building2}
            title={`Portfolio startups${linked.length > 0 ? ` (${linked.length})` : ""}`}
            right={
              linked.length > 0 ? (
                <Link
                  to="/investors/$id/portfolio"
                  params={{ id: i.id }}
                  search={portfolioSearch}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  View Portfolio →
                </Link>
              ) : undefined
            }
          >
            {linked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No startups linked yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {linked.map((s) => (
                  <CompanyEntityPill
                    key={s.id}
                    to="/startups/$id"
                    id={s.id}
                    name={s.startup_name}
                    logoUrl={s.logo_signed_url}
                    onSelect={onSelectStartup}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Portfolio investors */}
          {portfolioInvestors.length > 0 && (
            <Section
              icon={Briefcase}
              title={`PORTFOLIO PE/VC (${portfolioInvestors.length})`}
              right={
                <Link
                  to="/investors/$id/portfolio"
                  params={{ id: i.id }}
                  search={portfolioSearch}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  View Alternative Investment →
                </Link>
              }
            >
              <div className="flex flex-wrap gap-2">
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
            </Section>
          )}

        </>
      )}
    </div>
  );
}

export function InvestorDetailEmpty() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <Briefcase className="mb-2 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">Select an investor</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick a card on the left to see its intelligence here.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  right,
}: {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-[11.2px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {title}
        </h3>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function PairedSection({
  left,
  right,
  className,
}: {
  left: { icon: typeof Calendar; title: string; content: React.ReactNode };
  right: { icon: typeof Calendar; title: string; content: React.ReactNode };
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid border-t border-b border-border/50 py-[11.2px]",
        "max-[700px]:grid-cols-1 max-[700px]:divide-y max-[700px]:divide-border/50 max-[700px]:gap-0",
        "min-[700px]:grid-cols-[1fr_1px_1fr] min-[700px]:gap-[11.5px]",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <left.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {left.title}
        </h3>
        <div className="min-w-0">{left.content}</div>
      </div>
      <div className="hidden w-px bg-[#EEEEEE] self-stretch min-[700px]:block" aria-hidden />
      <div className="min-w-0 max-[700px]:pt-[11.2px]">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <right.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {right.title}
        </h3>
        <div className="min-w-0">{right.content}</div>
      </div>
    </section>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const base =
    tone === "primary"
      ? "bg-primary/5 text-foreground/85 border-primary/20"
      : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${base}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function LightboxOverlay({ url, onClose }: { url: string; onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = hovered || focused;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative inline-block"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img src={url} alt="" className="block max-h-[67vh] max-w-[67vw] rounded-lg object-contain" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Close image"
          className={cn(
            "absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-opacity duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            visible ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
