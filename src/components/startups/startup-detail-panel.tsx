import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  MapPin,
  Calendar,
  Linkedin,
  Rocket,
  Pencil,
  Loader2,
  Globe,
  Building2,
  TrendingUp,
  Layers,
  ShoppingCart,
  Users,
  UserCircle2,
  FileText,
  Share2,
  MoreVertical,
  Link2,
  Copy,
  Activity,
  Archive,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FavoriteToggle } from "@/components/startups/favorite-toggle";
import { useStartup } from "@/hooks/use-startup";
import { usePermissions } from "@/hooks/use-session-context";
import { GlobalStartupLineageBadge } from "@/components/global-startups/global-startup-lineage-badge";
import { PreviewNeedsReassignmentBadge } from "@/components/intake/needs-reassignment-badge";
import { PublicationActions } from "@/components/startups/publication-actions";
import { useRestrictionMask } from "@/hooks/use-startup-restrictions";
import { MaskedImage, restrictedSet } from "@/components/startups/restricted-placeholder";
import { cn } from "@/lib/utils";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function StartupDetailPanel({
  id,
  showEdit = true,
  compact = false,
  showPublication = false,
  workspace = "startups",
  onClose,
}: {
  id: string;
  showEdit?: boolean;
  compact?: boolean;
  /** My Startups surfaces only: shows Publish / Unpublish to Startup Directory. */
  showPublication?: boolean;
  /** Which module owns this surface — keeps edit navigation inside that module. */
  workspace?: "startups" | "my-startups";
  onClose?: () => void;
}) {
  const isMyWorkspace = workspace === "my-startups";
  const { data, isLoading, error } = useStartup(id);
  // Basic Information Restrictions gate what non-authorized viewers receive.
  const { mask } = useRestrictionMask(workspace);
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    // Measure natural (unclamped) height against clamped height
    const prev = el.style.webkitLineClamp;
    el.style.webkitLineClamp = "unset";
    const full = el.scrollHeight;
    el.style.webkitLineClamp = prev;
    setDescClamped(full > el.clientHeight + 1);
  }, [data?.long_description]);



  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(`${window.location.origin}/startups/${id}`);
    }
  };

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

  const s = mask(data);
  const restricted = restrictedSet(s);



  const mediaMasked = restricted.has("media_images");
  const mediaSlots = mediaMasked ? s.media : s.media.filter((m) => m.image_signed_url);

  const metaItems: { icon: typeof Calendar; label: React.ReactNode }[] = [];
  if (s.year_founded) metaItems.push({ icon: Calendar, label: `Est. ${s.year_founded}` });
  if (s.company_type) metaItems.push({ icon: Building2, label: s.company_type });
  if (s.headquarters) metaItems.push({ icon: MapPin, label: s.headquarters });
  if (s.investment_stage) metaItems.push({ icon: TrendingUp, label: s.investment_stage });

  return (
    <div className="space-y-[14px] text-foreground">
      {/* Header */}
      <header className={cn("flex items-start justify-between gap-4", compact && "pt-1")}>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
            {restricted.has("logo") ? (
              <MaskedImage seed={`${s.id}-logo`} cells={8} />
            ) : s.logo_signed_url ? (
              <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {monogram(s.startup_name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight leading-tight">
              {s.startup_name}
              <PreviewNeedsReassignmentBadge
                name={s.startup_name}
                domain="startup"
                className="ml-2 align-middle"
              />
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              {!compact && s.tenant_name && <span>{s.tenant_name}</span>}
              {!compact && s.tenant_name && (s.headquarters || s.industry?.length) && (
                <span aria-hidden>·</span>
              )}
              {s.headquarters && <span>{s.headquarters}</span>}
              {s.headquarters && s.industry?.length ? <span aria-hidden>·</span> : null}
              {s.industry?.length ? <span>{s.industry.join(" · ")}</span> : null}
            </div>
            <div className="mt-2">
              <GlobalStartupLineageBadge
                sourceGlobalId={
                  (s as unknown as { source_global_id: string | null }).source_global_id
                }
                importedAt={(s as unknown as { imported_at: string | null }).imported_at}
              />
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
              <Link to={isMyWorkspace ? "/my-startups/$id/edit" : "/startups/$id/edit"} params={{ id }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
          )}
          {compact && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full border-accent/40 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/10 hover:text-accent"
              >
                <Share2 className="h-3.5 w-3.5" /> Share Info
              </Button>
              <FavoriteToggle id={id} size="md" className="h-8 w-8" />

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
                  <DropdownMenuItem disabled>
                    <Link2 className="mr-2 h-4 w-4" /> Connect
                    <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </DropdownMenuItem>
                  {canManage ? (
                    <DropdownMenuItem asChild>
                      <Link to={isMyWorkspace ? "/my-startups/$id/edit" : "/startups/$id/edit"} params={{ id }} onClick={() => onClose?.()}>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirm("archive");
                    }}
                    className="text-amber-600 focus:bg-amber-50 focus:text-amber-700 dark:focus:bg-amber-950/40"
                  >
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirm("delete");
                    }}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      {showPublication && (
        <PublicationActions
          startup={s as unknown as Parameters<typeof PublicationActions>[0]["startup"]}
          canPublish={canManage}
        />
      )}



      <AlertDialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive startup?</AlertDialogTitle>
            <AlertDialogDescription>
              This startup will be archived and removed from the active startup view. You can
              restore it later if archive restoration is supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled
              className="bg-amber-600 text-white hover:bg-amber-600/90"
              title="Backend integration pending"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete startup?</AlertDialogTitle>
            <AlertDialogDescription>
              This action may permanently remove the startup record. This cannot be undone unless
              recovery is supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              title="Backend integration pending"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                onClick={() => !mediaMasked && m.image_signed_url && setLightbox(m.image_signed_url)}
                className={cn(
                  "block overflow-hidden rounded-lg bg-muted/40 text-left",
                  single ? "w-[48%] max-w-[50%]" : "aspect-video",
                )}
                style={single ? { aspectRatio: "64 / 25" } : undefined}
              >
                {mediaMasked ? (
                  <MaskedImage seed={`${s.id}-media-${m.slot}`} cells={12} label="Restricted image" />
                ) : (
                  <img
                    src={m.image_signed_url ?? ""}
                    alt={m.caption ?? ""}
                    className={cn(
                      "h-full w-full transition duration-300 hover:scale-105",
                      single ? "object-cover object-center" : "object-cover",
                    )}
                  />
                )}

              </button>
            );
          })}
        </div>
      )}

      {lightbox && typeof document !== "undefined" && createPortal(
        <LightboxOverlay url={lightbox} onClose={() => setLightbox(null)} />,
        document.body,
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
              <span className="truncate">
                Company URL <span aria-hidden>→</span>
              </span>
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
          <p
            ref={descRef}
            className={cn(
              "whitespace-pre-line text-[14px] leading-relaxed text-foreground/85",
              !descExpanded && "line-clamp-4",
            )}
          >
            {s.long_description}
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
        <Section
          icon={UserCircle2}
          title={`Founder${s.founders.length > 1 ? `s (${s.founders.length})` : ""}`}
        >
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.founders.map((f) => (
              <div key={f.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/60 text-xs font-semibold text-muted-foreground">
                  {restricted.has("founders") ? (
                    <MaskedImage seed={`${s.id}-${f.id}`} cells={6} className="rounded-full" showLock={false} label="Restricted founder picture" />
                  ) : (
                    (f.full_name ?? "").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{f.full_name}</div>
                  {f.position && (
                    <div className="text-xs text-muted-foreground mt-0.5">{f.position}</div>
                  )}
                  {f.bio && (
                    <p className="mt-1 text-xs text-foreground/75 leading-relaxed">{f.bio}</p>
                  )}
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
        <Section
          icon={Users}
          title={`Investor${s.investors.length > 1 ? `s (${s.investors.length})` : ""}`}
        >
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
}: {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-[11.2px]">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {title}
      </h3>
      <div>{children}</div>
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
      style={{ pointerEvents: "auto" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative inline-block"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-testid="lightbox-hover-area"
      >
        <img
          src={url}
          alt=""
          className="block max-h-[67vh] max-w-[67vw] rounded-lg object-contain"
        />
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
