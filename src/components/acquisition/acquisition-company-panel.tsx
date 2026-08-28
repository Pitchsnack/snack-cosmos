/**
 * Target Company / Competitor Reference information panels for My Startups.
 *
 * Opened by clicking a pill on a My Startups card. Rendered as a temporary
 * overlay — closing (X, Esc, backdrop) returns the user to the same My
 * Startups page, view and scroll position. Linked acquisition targets open
 * the full startup record via LinkedStartupPanel instead; this component
 * renders manual (unlinked) targets and all competitor references.
 */

import {
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Layers,
  Link2,
  MapPin,
  ShoppingCart,
  X,
} from "lucide-react";


import { Badge } from "@/components/ui/badge";
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

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/50 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function KeywordPills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((k) => (
        <span
          key={k}
          className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
        >
          {k}
        </span>
      ))}
    </div>
  );
}


function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground/85">
          {value || <span className="text-muted-foreground">Not available</span>}
        </dd>
      </div>
    </div>
  );
}

export function AcquisitionCompanyPanel({
  target,
  competitor,
  onClose,
}: {
  /** Manual (unlinked) acquisition target to show; null when closed or linked. */
  target: TargetCompany | null;
  /** Competitor reference to show; null when closed. */
  competitor: CompetitorReference | null;
  onClose: () => void;
}) {
  const entry = target ?? competitor;
  const isCompetitor = !!competitor;
  const snap = entry?.linkedSnapshot ?? null;
  const logo = entry?.logo ?? snap?.logo ?? null;
  const industry = snap?.industry ?? [];
  const productTags = snap?.productTags ?? [];
  const marketTags = snap?.marketTags ?? [];


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
            <div className="relative h-10 shrink-0">
              <DialogClose
                aria-label="Back to Acquisition Strategy"
                title="Back to Acquisition Strategy"
                className="absolute right-3 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <p className="text-[15px] leading-relaxed text-foreground/85">
                {snap?.shortDescription || (
                  <span className="text-muted-foreground">No description available yet.</span>
                )}
              </p>

              {/* Standard company information fields */}
              <PanelSection label="Company Information">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Field icon={Building2} label="Company Name" value={entry.name} />
                  <Field
                    icon={Globe}
                    label="Website"
                    value={
                      entry.website ? (
                        <a
                          href={websiteHref(entry.website)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-900 hover:underline"
                        >
                          {entry.website.replace(/^https?:\/\//i, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null
                    }
                  />
                  <Field icon={MapPin} label="Headquarters" value={snap?.headquarters ?? null} />
                  <Field icon={MapPin} label="City" value={snap?.city ?? null} />
                  <Field icon={Layers} label="Industry" value={industry.length ? industry.join(", ") : null} />
                  <Field
                    icon={ShoppingCart}
                    label="Market Tags"
                    value={marketTags.length ? marketTags.join(", ") : null}
                  />
                  <Field
                    icon={Layers}
                    label="Product & Service Tags"
                    value={productTags.length ? productTags.join(", ") : null}
                  />
                  <Field
                    icon={Calendar}
                    label={isCompetitor ? "Last Extracted" : "Record Type"}
                    value={
                      isCompetitor
                        ? formatDate(competitor?.lastExtractedAt ?? null)
                        : entry.linkedStartupId
                          ? "Linked startup record"
                          : "Manual entry"
                    }
                  />
                </dl>
              </PanelSection>

              {/* Why attractive */}
              <PanelSection label={isCompetitor ? "Why Relevant" : "Why Attractive"}>
                {entry.attractiveKeywords.length > 0 ? (
                  <KeywordPills items={entry.attractiveKeywords} />
                ) : (
                  <span className="text-sm text-muted-foreground">Not available</span>
                )}
              </PanelSection>

              {/* Notes */}
              <PanelSection label="Notes">
                {entry.notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.notes}</p>
                ) : (
                  <span className="text-sm text-muted-foreground">Not available</span>
                )}
              </PanelSection>

              {/* Competitor extraction results */}
              {competitor?.result && (
                <>
                  {competitor.result.acquisitionHistory.length > 0 && (
                    <PanelSection label="Acquisition History">
                      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
                        {competitor.result.acquisitionHistory.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </PanelSection>
                  )}
                  {competitor.result.acquiredCompanies.length > 0 && (
                    <PanelSection label="Acquired Companies">
                      <KeywordPills items={competitor.result.acquiredCompanies} />
                    </PanelSection>
                  )}
                  {competitor.result.commonThemes.length > 0 && (
                    <PanelSection label="Common Themes">
                      <KeywordPills items={competitor.result.commonThemes} />
                    </PanelSection>
                  )}
                  {competitor.result.strategicPatterns.length > 0 && (
                    <PanelSection label="Strategic Pattern Summary">
                      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
                        {competitor.result.strategicPatterns.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </PanelSection>
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
