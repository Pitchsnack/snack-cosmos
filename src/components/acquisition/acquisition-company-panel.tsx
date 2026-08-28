/**
 * Target Company / Competitor Reference information panels for My Startups.
 *
 * Opened by clicking a pill on a My Startups card. Rendered as a temporary
 * overlay — closing (X, Esc, backdrop) returns the user to the same My
 * Startups page, view and scroll position. Linked acquisition targets open
 * the full startup record via LinkedStartupPanel instead; this component
 * renders manual (unlinked) targets and all competitor references.
 */

import { useState } from "react";
import {
  Building2,
  Calendar,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Link2,
  MapPin,
  MoreVertical,
  Pencil,
  Share2,
  ShoppingCart,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";



import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  EXTRACTION_STATUS_LABEL,
  type CompetitorReference,
  type ExtractionStatus,
  type TargetCompany,
} from "@/lib/acquisition/strategy-store";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ExtractionStatus, string> = {
  not_extracted: "border-transparent bg-muted/60 text-muted-foreground",
  pending: "border-accent/40 bg-accent/10 text-accent-foreground",
  extracted: "border-primary/30 bg-primary/5 text-primary",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Same section chrome as the standard Startup Information Panel:
 * top border, uppercase tracked label with a leading icon.
 */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-[11.2px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {title}
        </h3>
      </div>
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


export function AcquisitionCompanyPanel({
  target,
  competitor,
  onClose,
  onEdit,
  onDelete,
}: {
  /** Manual (unlinked) acquisition target to show; null when closed or linked. */
  target: TargetCompany | null;
  /** Competitor reference to show; null when closed. */
  competitor: CompetitorReference | null;
  onClose: () => void;
  /** Optional: opens the edit dialog for this entry. */
  onEdit?: () => void;
  /** Optional: removes this entry from the strategy. */
  onDelete?: () => void;
}) {
  const entry = target ?? competitor;
  const isCompetitor = !!competitor;
  const snap = entry?.linkedSnapshot ?? null;
  const logo = entry?.logo ?? snap?.logo ?? null;
  const industry = snap?.industry ?? [];
  const productTags = snap?.productTags ?? [];
  const marketTags = snap?.marketTags ?? [];
  const [menuOpen, setMenuOpen] = useState(false);

  const summary = entry
    ? [
        entry.name,
        entry.website ? websiteHref(entry.website) : null,
        snap?.headquarters ?? null,
        snap?.shortDescription ?? entry.notes ?? null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const handleShare = async () => {
    if (!entry) return;
    if (typeof navigator === "undefined") return;
    const nav: Navigator & { share?: (d: ShareData) => Promise<void> } = navigator;
    try {
      if (nav.share) {
        await nav.share({
          title: entry.name,
          text: summary,
          ...(entry.website ? { url: websiteHref(entry.website) } : {}),
        });
        return;
      }
      await nav.clipboard?.writeText(summary);
      toast.success("Company info copied to clipboard");
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const handleCopyLink = async () => {
    if (!entry?.website) {
      await navigator.clipboard?.writeText(summary);
      toast.success("Company info copied");
      return;
    }
    await navigator.clipboard?.writeText(websiteHref(entry.website));
    toast.success("Link copied");
  };


  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "[&>button]:hidden",
          "p-0 gap-0 flex flex-col overflow-hidden",
          "sm:max-w-xl sm:max-h-[85vh] sm:rounded-2xl",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:w-full max-sm:max-h-[90vh] max-sm:rounded-t-2xl max-sm:rounded-b-none",
        )}
      >
        <DialogTitle className="sr-only">
          {isCompetitor ? "Competitor reference information" : "Target company information"}
        </DialogTitle>
        {entry && (
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-end gap-1 px-3 pt-2">
              <Button
                size="sm"
                onClick={handleShare}
                className="gap-1.5 rounded-full bg-[hsl(263_70%_42%)] text-white hover:bg-[hsl(263_70%_36%)]"
              >
                <Share2 className="h-3.5 w-3.5" /> Share Info
              </Button>

              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
                  <DropdownMenuItem onSelect={() => void handleCopyLink()}>
                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                  </DropdownMenuItem>
                  {entry.website && (
                    <DropdownMenuItem asChild>
                      <a href={websiteHref(entry.website)} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Open Website
                      </a>
                    </DropdownMenuItem>
                  )}
                  {onEdit ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        onClose();
                        onEdit();
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          onClose();
                          onDelete();
                        }}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DialogClose
                aria-label="Back to Acquisition Strategy"
                title="Back to Acquisition Strategy"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            </div>

            <div className="flex-1 space-y-[14px] overflow-y-auto px-5 pb-5 pt-1 text-foreground">
              {/* Header — standard Information Panel format */}
              <header className="flex items-start gap-4 pt-1">
                <div className="flex h-12 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  {logo ? (
                    <img src={logo} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {monogram(entry.name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                    {entry.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                    {snap?.headquarters && <span>{snap.headquarters}</span>}
                    {snap?.headquarters && industry.length ? <span aria-hidden>·</span> : null}
                    {industry.length ? <span>{industry.join(" · ")}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {isCompetitor ? "Competitor Reference" : "Acquisition Target"}
                    </Badge>
                    {entry.linkedStartupId && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-blue-900/30 bg-blue-900/5 text-blue-900"
                      >
                        <Link2 className="h-3 w-3" /> Linked
                      </Badge>
                    )}
                    {competitor && (
                      <Badge variant="outline" className={cn("gap-1", STATUS_TONE[competitor.status])}>
                        {EXTRACTION_STATUS_LABEL[competitor.status]}
                      </Badge>
                    )}
                  </div>
                </div>
              </header>

              {/* Short description */}
              {snap?.shortDescription && (
                <p className="text-[15px] leading-relaxed text-foreground/85">
                  {snap.shortDescription}
                </p>
              )}

              {/* Meta grid — same shape as the Startup Information Panel */}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-2 text-foreground/80">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span>{isCompetitor ? "Competitor Reference" : "Acquisition Target"}</span>
                </div>
                {snap?.headquarters && (
                  <div className="flex items-center gap-2 text-foreground/80">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>{snap.headquarters}</span>
                  </div>
                )}
                {snap?.city && (
                  <div className="flex items-center gap-2 text-foreground/80">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>{snap.city}</span>
                  </div>
                )}
                {isCompetitor && formatDate(competitor?.lastExtractedAt ?? null) && (
                  <div className="flex items-center gap-2 text-foreground/80">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>Extracted {formatDate(competitor?.lastExtractedAt ?? null)}</span>
                  </div>
                )}
                {entry.website && (
                  <a
                    href={websiteHref(entry.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-blue-900 hover:underline"
                  >
                    <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">
                      Company URL <span aria-hidden>→</span>
                    </span>
                  </a>
                )}
              </dl>

              {/* Notes — mirrors "Product overview" */}
              {entry.notes && (
                <Section icon={FileText} title="Notes">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground/85">
                    {entry.notes}
                  </p>
                </Section>
              )}

              {productTags.length > 0 && (
                <Section icon={Layers} title="Product & service tags">
                  <ChipRow tags={productTags} tone="primary" />
                </Section>
              )}

              {marketTags.length > 0 && (
                <Section icon={ShoppingCart} title="Market tags">
                  <ChipRow tags={marketTags} tone="muted" />
                </Section>
              )}

              {entry.attractiveKeywords.length > 0 && (
                <Section icon={Target} title={isCompetitor ? "Why relevant" : "Why attractive"}>
                  <ChipRow tags={entry.attractiveKeywords} tone="primary" />
                </Section>
              )}

              {/* Competitor extraction results */}
              {competitor?.result && (
                <>
                  {competitor.result.acquisitionHistory.length > 0 && (
                    <Section icon={FileText} title="Acquisition history">
                      <ul className="list-disc space-y-1 pl-4 text-[14px] leading-relaxed text-foreground/85">
                        {competitor.result.acquisitionHistory.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  {competitor.result.acquiredCompanies.length > 0 && (
                    <Section icon={Building2} title="Acquired companies">
                      <ChipRow tags={competitor.result.acquiredCompanies} tone="muted" />
                    </Section>
                  )}
                  {competitor.result.commonThemes.length > 0 && (
                    <Section icon={Layers} title="Common themes">
                      <ChipRow tags={competitor.result.commonThemes} tone="primary" />
                    </Section>
                  )}
                  {competitor.result.strategicPatterns.length > 0 && (
                    <Section icon={Target} title="Strategic pattern summary">
                      <ul className="list-disc space-y-1 pl-4 text-[14px] leading-relaxed text-foreground/85">
                        {competitor.result.strategicPatterns.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}

            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
