import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  MapPin,
  Calendar,
  Rocket,
  Pencil,
  Building2,
  Users,
  FileText,
  MoreVertical,
  Copy,
  Activity,
  Archive,
  Trash2,
  X,
  Check,
  Share2,
  LayoutTemplate,
  BarChart3,
  Target,

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
import {
  ConnectionAction,
  ConnectionStateCard,
} from "@/components/startups/connection-action";
import { useConnectionState } from "@/hooks/use-connection-state";

import { useRestrictionMask } from "@/hooks/use-startup-restrictions";
import { MaskedImage, restrictedSet } from "@/components/startups/restricted-placeholder";
import { ShareStartupDialog } from "@/components/startups/share-startup-dialog";
import { cn } from "@/lib/utils";
import { CompanyEntityPill } from "@/components/relationships/company-entity-pill";
import { StartupInfoBody } from "@/components/startups/startup-info-body";
import { useHasFinancials } from "@/hooks/use-has-financials";
import { HatSkeleton } from "@/components/ui/PitchSnackLoader";



function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Financials shortcut. Colour-coded: solid emerald when Auto Enrich has already
 * produced data for the startup, muted outline when there is nothing yet.
 */
function FinancialsAction({
  id,
  isMyWorkspace,
  onClose,
}: {
  id: string;
  isMyWorkspace: boolean;
  onClose?: () => void;
}) {
  const { hasData, prefetch } = useHasFinancials(id);
  const label = hasData ? "Financials available" : "No financial data yet";
  const content = (
    <>
      <BarChart3 className="h-3.5 w-3.5" /> Financials
    </>
  );
  return (
    <Button
      asChild
      size="sm"
      variant={hasData ? "default" : "outline"}
      title={label}
      aria-label={label}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onPointerDown={prefetch}
      className={cn(
        "gap-1.5 rounded-full",
        hasData
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {isMyWorkspace ? (
        <Link to="/my-startups/$id/financials" params={{ id }} onClick={() => onClose?.()}>
          {content}
        </Link>
      ) : (
        <Link to="/startups/$id/financials" params={{ id }} onClick={() => onClose?.()}>
          {content}
        </Link>
      )}
    </Button>
  );
}


export function StartupDetailPanel({
  id,
  showEdit = true,
  compact = false,
  showPublication = false,
  workspace = "startups",
  onClose,
  myStartupsReturnSearch,
  returnSearch,
  onSelectInvestor,
}: {
  id: string;
  showEdit?: boolean;
  compact?: boolean;
  /** My Startups surfaces only: shows Publish / Unpublish to Startup Directory. */
  showPublication?: boolean;
  /** Which module owns this surface — keeps edit navigation inside that module. */
  workspace?: "startups" | "my-startups";
  onClose?: () => void;
  /** List state restored after editing from the My Startups information panel. */
  myStartupsReturnSearch?: {
    q?: string;
    stage?: string;
    industry?: string;
    hq?: string;
    ct?: string;
    ptag?: string;
    mtag?: string;
    sort?: "updated_desc" | "created_desc" | "name_asc" | "name_desc";
    view?: "grid" | "split" | "list";
    selected?: string;
    page?: number;
    fav?: boolean;
  };
  /** List state restored after editing from the Startup Directory panel. */
  returnSearch?: {
    q?: string;
    stage?: string;
    industry?: string;
    hq?: string;
    ct?: string;
    ptag?: string;
    mtag?: string;
    sort?: "updated_desc" | "created_desc" | "name_asc" | "name_desc";
    view?: "grid" | "split" | "list";
    selected?: string;
    page?: number;
    fav?: boolean;
  };
  /** When provided, investor chips open an in-place investor panel instead of navigating. */
  onSelectInvestor?: (id: string) => void;
}) {
  const isMyWorkspace = workspace === "my-startups";
  const directoryReturnSearch = returnSearch;

  const { data, isLoading, error } = useStartup(id);
  const connectionState = useConnectionState(id);
  // Basic Information Restrictions gate what non-authorized viewers receive.
  const { mask } = useRestrictionMask(workspace);
  const { has, isControl } = usePermissions();
  const canManage = isControl || has("startups.write");
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);






  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(`${window.location.origin}/startups/${id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] p-8">
        <HatSkeleton lines={5} headMessage="Loading startup…" />
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

  // Relationship counterpart: primary founder when available, else the startup.
  const primaryFounder = s.founders?.[0];
  const counterpartName = primaryFounder?.full_name || s.startup_name;
  const counterpartRole = primaryFounder
    ? [primaryFounder.position, s.startup_name].filter(Boolean).join(" · ")
    : (s.company_type ?? null);


  const mediaMasked = restricted.has("media_images");
  const mediaSlots = mediaMasked ? s.media : s.media.filter((m) => m.image_signed_url);


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
          {(
            <div className="flex items-center gap-1">

              {isMyWorkspace ? (
                <Button
                  size="sm"
                  onClick={() => setShareOpen(true)}
                  className="gap-1.5 rounded-full bg-[hsl(263_70%_42%)] text-white hover:bg-[hsl(263_70%_36%)]"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share Info
                </Button>
              ) : (
                <ConnectionAction startupRef={id} onShare={() => setShareOpen(true)} />
              )}
              <FinancialsAction id={id} isMyWorkspace={isMyWorkspace} onClose={onClose} />
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
                  <DropdownMenuItem onSelect={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    {isMyWorkspace ? (
                      <Link to="/my-startups/$id/cover" params={{ id }} onClick={() => onClose?.()}>
                        <LayoutTemplate className="mr-2 h-4 w-4" /> View Cover Page
                      </Link>
                    ) : (
                      <Link to="/startups/$id/cover" params={{ id }} onClick={() => onClose?.()}>
                        <LayoutTemplate className="mr-2 h-4 w-4" /> View Cover Page
                      </Link>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    {isMyWorkspace ? (
                      <Link to="/my-startups/$id/financials" params={{ id }} onClick={() => onClose?.()}>
                        <BarChart3 className="mr-2 h-4 w-4" /> Financials
                      </Link>
                    ) : (
                      <Link to="/startups/$id/financials" params={{ id }} onClick={() => onClose?.()}>
                        <BarChart3 className="mr-2 h-4 w-4" /> Financials
                      </Link>
                    )}
                  </DropdownMenuItem>




                  {canManage ? (
                    <DropdownMenuItem asChild>
                      {isMyWorkspace ? (
                        <Link to="/my-startups/$id/edit" params={{ id }} search={myStartupsReturnSearch}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Link>
                      ) : (
                        <Link to="/startups/$id/edit" params={{ id }} search={directoryReturnSearch} onClick={() => onClose?.()}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Link>
                      )}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  {isMyWorkspace && (
                    <DropdownMenuItem asChild>
                      <Link to="/my-startups/$id/acquisition" params={{ id }} onClick={() => onClose?.()}>
                        <Target className="mr-2 h-4 w-4" /> Acquisition Strategy
                      </Link>
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

      {/* Steps 2 & 4 — relationship state (Connect → Requested → Share) */}
      {!isMyWorkspace && (
        <ConnectionStateCard
          startupRef={id}
          counterpartName={counterpartName}
          counterpartRole={counterpartRole}
        />
      )}

      <ShareStartupDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        startup={{
          name: s.startup_name,
          tagline: s.short_description,
          location: s.headquarters,
          website: s.website_url,
          logoUrl: restricted.has("logo") ? null : s.logo_signed_url,
        }}
      />






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

      {!isMyWorkspace && connectionState === "requested" ? null : (
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


      {mediaSlots.length === 0 && (
        <Section icon={FileText} title="Media">
          <span className="text-sm text-muted-foreground">Not available</span>
        </Section>
      )}

      {/* Canonical Startup Information Panel body — identical on every surface */}
      <StartupInfoBody
        data={{
          name: s.startup_name,
          registeredName: s.registered_name,
          companyType: s.company_type,
          yearFounded: s.year_founded,
          investmentStage: s.investment_stage,
          companySize: s.company_size,
          revenue: s.last_year_revenue,
          headquarters: s.headquarters,
          region: s.region,
          city: s.city,
          website: s.website_url,
          email: s.email,
          linkedinUrl: s.linkedin_url,
          shortDescription: s.short_description,
          longDescription: s.long_description,
          industry: s.industry ?? [],
          productTags: s.product_tags,
          marketTags: s.market_tags,
          founders: s.founders.map((f) => ({
            id: f.id,
            fullName: f.full_name,
            position: f.position,
            bio: f.bio,
            linkedinUrl: f.linkedin_url,
          })),
        }}
        renderFounderAvatar={(f) =>
          restricted.has("founders") ? (
            <MaskedImage
              seed={`${s.id}-${f.id}`}
              cells={6}
              className="rounded-full"
              showLock={false}
              label="Restricted founder picture"
            />
          ) : (
            (f.fullName ?? "").charAt(0).toUpperCase()
          )
        }
      />


      {/* Investors */}
      {s.investors.length > 0 && (
        <Section
          icon={Users}
          title={`INVESTORS (${s.investors.length})`}
          right={
            <Link
              to="/startups/$id/investors"
              params={{ id }}
              className="text-xs font-medium text-blue-900 hover:underline"
            >
              View Investors →
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            {s.investors.map((i) => (
              <CompanyEntityPill
                key={i.id}
                to={onSelectInvestor ? undefined : "/investors/$id"}
                id={i.investor_id}
                name={i.investor_name}
                logoUrl={i.logo_signed_url}
                onSelect={onSelectInvestor}
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
