import { useEffect, useState } from "react";
import { ExternalLink, Link2, Loader2, Sparkles, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutoEnrichButton } from "@/components/startups/auto-enrich-button";
import { LogoSlot, EMPTY_SLOT, type SlotState } from "@/components/media/entity-media-editor";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import { DuplicateWarningDialog } from "@/components/relationships/duplicate-warning-dialog";
import { useWebsiteDuplicateCheck, normalizeWebsite } from "@/hooks/use-website-duplicate-check";
import { TagInput } from "@/components/acquisition/tag-input";
import { fileToLogoDataUrl } from "@/lib/acquisition/logo-data-url";
import {
  acquisitionAttractivenessKeywords,
  type LinkedStartupSnapshot,
} from "@/lib/acquisition/strategy-store";
import type { EnrichStartupResult } from "@/lib/auto-enrich/auto-enrich-adapter";
import type { StartupListItem } from "@/lib/startups.functions";

export const MAX_ATTRACTIVE_KEYWORDS = 5;

export const ATTRACTIVE_KEYWORD_SUGGESTIONS = [
  "Strategic Technology",
  "Market Expansion",
  "Strong IP",
  "Customer Base",
  "Product Synergy",
  "Talent Acquisition",
  "Recurring Revenue",
  "Cost Synergies",
];

export interface CompanyFormValue {
  name: string;
  website: string;
  /** Data URL (uploaded/snipped logo) or remote URL (auto-enrich favicon). */
  logo: string | null;
  attractiveKeywords: string[];
  notes: string;
  /** Existing startup record id when linked via "Use This Startup"; null = manual entry. */
  linkedStartupId: string | null;
  /** Display snapshot of the linked startup (only when linkedStartupId is set). */
  linkedSnapshot: LinkedStartupSnapshot | null;
}

export const EMPTY_COMPANY_FORM: CompanyFormValue = {
  name: "",
  website: "",
  logo: null,
  attractiveKeywords: [],
  notes: "",
  linkedStartupId: null,
  linkedSnapshot: null,
};

/** Public favicon for the website host — Auto Enrich's logo suggestion. */
function faviconUrlFor(website: string): string | null {
  const host = normalizeWebsite(website);
  return host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
}

function hasLogo(slot: SlotState): boolean {
  return !!(slot.pendingFile || slot.signedUrl || slot.persistedPath);
}

/** Display snapshot of an existing startup row, reused by the linked target. */
function snapshotFromStartup(r: StartupListItem): LinkedStartupSnapshot {
  return {
    name: r.startup_name,
    website: r.website_url ?? "",
    logo: r.logo_signed_url,
    shortDescription: r.short_description,
    industry: r.industry ?? [],
    productTags: r.product_tags ?? [],
    marketTags: r.market_tags ?? [],
    headquarters: r.headquarters,
    city: r.city,
  };
}

/**
 * Shared Add/Edit dialog for acquisition-strategy companies (target
 * companies and competitor references). Composition:
 *   Name → Website (P-18 duplicate check) → Logo (drag&drop/upload/snip)
 *   → ✨ Auto Enrich → Why attractive (≤5 keyword pills) → Notes
 *
 * When the P-18 duplicate check finds an existing startup and the user picks
 * "Use This Startup", the dialog switches to LINKED mode: the existing
 * record's data (logo, name, website, industry, product & market tags, HQ)
 * is displayed read-only and the entry becomes an Acquisition Target
 * relationship to that record — no new/duplicate startup profile is created.
 * Only the acquisition-specific fields (Why attractive, Notes) stay editable,
 * with "✨ Auto Enrich Acquisition Analysis" proposing attractiveness pills.
 */
export function CompanyFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  nameLabel,
  namePlaceholder,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  nameLabel: string;
  namePlaceholder?: string;
  /** Pre-fill for edit mode; null/undefined starts empty. */
  initial?: CompanyFormValue | null;
  onSave: (value: CompanyFormValue) => void;
}) {
  const [form, setForm] = useState<CompanyFormValue>(EMPTY_COMPANY_FORM);
  const [logoSlot, setLogoSlot] = useState<SlotState>(EMPTY_SLOT);
  const [saving, setSaving] = useState(false);
  const websiteDup = useWebsiteDuplicateCheck();

  useEffect(() => {
    if (!open) return;
    const init = initial ?? EMPTY_COMPANY_FORM;
    setForm({
      name: init.name,
      website: init.website,
      logo: init.logo,
      attractiveKeywords: [...init.attractiveKeywords],
      notes: init.notes,
      linkedStartupId: init.linkedStartupId ?? null,
      linkedSnapshot: init.linkedSnapshot ?? null,
    });
    setLogoSlot(init.logo ? { ...EMPTY_SLOT, signedUrl: init.logo } : EMPTY_SLOT);
    setSaving(false);
  }, [open, initial]);

  const linked = form.linkedStartupId && form.linkedSnapshot ? form.linkedSnapshot : null;

  /** P-18 "Use This Startup" — link to the existing record, never duplicate it. */
  const linkExisting = (candidateId: string | null) => {
    websiteDup.close();
    const row = websiteDup.startupById(candidateId);
    if (!row) {
      // Candidate did not resolve to a real record — fall back to viewing it.
      if (candidateId) window.open(`/startups/${candidateId}`, "_blank", "noopener,noreferrer");
      return;
    }
    const snap = snapshotFromStartup(row);
    setForm((f) => ({
      ...f,
      name: snap.name,
      website: snap.website,
      logo: snap.logo,
      linkedStartupId: row.id,
      linkedSnapshot: snap,
    }));
    setLogoSlot(snap.logo ? { ...EMPTY_SLOT, signedUrl: snap.logo } : EMPTY_SLOT);
    toast.success(`Linked to existing startup “${snap.name}”`);
  };

  const unlink = () => {
    setForm((f) => ({ ...f, linkedStartupId: null, linkedSnapshot: null }));
    toast.success("Unlinked — you can now edit the company details manually");
  };

  /** Manual mode: enrich only fills fields the user left empty. */
  const onEnriched = (result: EnrichStartupResult) => {
    setForm((f) => {
      let next = f;
      if (!f.name.trim() && result.startupName?.trim()) {
        next = { ...next, name: result.startupName.trim() };
      }
      if (next.attractiveKeywords.length === 0) {
        const pool = [
          ...(result.industries ?? []),
          ...(result.productTags ?? []),
          ...(result.marketTags ?? []),
        ];
        const seen = new Set<string>();
        const keywords: string[] = [];
        for (const raw of pool) {
          const k = raw.trim();
          const key = k.toLowerCase();
          if (!k || seen.has(key)) continue;
          seen.add(key);
          keywords.push(k);
          if (keywords.length >= MAX_ATTRACTIVE_KEYWORDS) break;
        }
        if (keywords.length > 0) next = { ...next, attractiveKeywords: keywords };
      }
      return next;
    });
    // Suggest the company logo (website favicon) only when none was chosen.
    setLogoSlot((slot) => {
      if (hasLogo(slot)) return slot;
      const fav = faviconUrlFor(form.website);
      return fav ? { ...EMPTY_SLOT, signedUrl: fav } : slot;
    });
  };

  /** Linked mode: propose acquisition-attractiveness pills (not a tag copy). */
  const enrichAcquisitionAnalysis = () => {
    if (!linked) return;
    if (form.attractiveKeywords.length > 0) {
      toast.info("Keywords already set — Auto Enrich never overwrites your input.");
      return;
    }
    const keywords = acquisitionAttractivenessKeywords(linked);
    if (keywords.length === 0) return;
    setForm((f) => ({ ...f, attractiveKeywords: keywords }));
    toast.success("Acquisition attractiveness analysis added");
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(`${nameLabel} is required`);
      return;
    }
    setSaving(true);
    try {
      let logo: string | null = null;
      if (logoSlot.pendingFile) {
        logo = await fileToLogoDataUrl(logoSlot.pendingFile);
      } else if (logoSlot.signedUrl) {
        logo = logoSlot.signedUrl; // data URL or remote favicon/linked logo
      }
      const linkedSnapshot = linked ? { ...linked, logo: logo ?? linked.logo } : null;
      onSave({
        name,
        website: form.website.trim(),
        logo,
        attractiveKeywords: form.attractiveKeywords.slice(0, MAX_ATTRACTIVE_KEYWORDS),
        notes: form.notes.trim(),
        linkedStartupId: linkedSnapshot ? form.linkedStartupId : null,
        linkedSnapshot,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process the logo image.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}

        <div className="space-y-4">
          {linked ? (
            /* ── Existing startup data (read-only relationship view) ── */
            <div className="space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <Link2 className="h-3 w-3" /> Existing Startup
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={unlink}
                  disabled={saving}
                >
                  <Unlink className="mr-1 h-3 w-3" /> Unlink
                </Button>
              </div>

              <div className="flex items-center gap-2.5">
                {linked.logo ? (
                  <img
                    src={linked.logo}
                    alt={`${linked.name} logo`}
                    className="h-9 w-9 shrink-0 rounded-md border border-border/60 bg-background object-contain"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {linked.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{linked.name}</div>
                  {linked.website && (
                    <a
                      href={/^https?:\/\//i.test(linked.website) ? linked.website : `https://${linked.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-900 hover:underline"
                    >
                      {linked.website} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {linked.shortDescription && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{linked.shortDescription}</p>
              )}

              {(linked.headquarters || linked.city) && (
                <p className="text-[11px] text-muted-foreground">
                  {[linked.headquarters, linked.city].filter(Boolean).join(" · ")}
                </p>
              )}

              {linked.industry.length > 0 && (
                <SnapshotTagRow label="Industry" tags={linked.industry} />
              )}
              {linked.productTags.length > 0 && (
                <SnapshotTagRow label="Product & Service" tags={linked.productTags} />
              )}
              {linked.marketTags.length > 0 && (
                <SnapshotTagRow label="Market" tags={linked.marketTags} />
              )}
            </div>
          ) : (
            /* ── Manual entry ── */
            <>
              <div className="space-y-1.5">
                <Label htmlFor="acf-name">{nameLabel}</Label>
                <Input
                  id="acf-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={namePlaceholder ?? "e.g. GreenTech Solutions"}
                  autoFocus
                />
              </div>

              <EditableUrlField
                label="Website"
                value={form.website}
                onChange={(v) => setForm({ ...form, website: v })}
                onCommit={(url) => void websiteDup.check(url)}
                placeholder="https://example.com"
              />

              <div className="flex flex-wrap items-end justify-between gap-3">
                <LogoSlot value={logoSlot} onChange={setLogoSlot} />
                <AutoEnrichButton
                  websiteUrl={form.website}
                  onEnriched={onEnriched}
                  disabled={saving}
                />
              </div>
            </>
          )}

          {/* ── Acquisition-specific data (always editable) ── */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>
                Why this company is attractive{" "}
                <span className="font-normal text-muted-foreground">
                  (up to {MAX_ATTRACTIVE_KEYWORDS} keywords)
                </span>
              </Label>
              {linked && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={enrichAcquisitionAnalysis}
                  disabled={saving}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Auto Enrich Acquisition Analysis
                </Button>
              )}
            </div>
            <TagInput
              value={form.attractiveKeywords}
              onChange={(next) =>
                setForm((f) => ({
                  ...f,
                  attractiveKeywords: next.slice(0, MAX_ATTRACTIVE_KEYWORDS),
                }))
              }
              placeholder="e.g. Strategic Technology"
              suggestions={ATTRACTIVE_KEYWORD_SUGGESTIONS}
              max={MAX_ATTRACTIVE_KEYWORDS}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acf-notes">Notes</Label>
            <Textarea
              id="acf-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Longer free-text comments about this company…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>

        <DuplicateWarningDialog
          open={websiteDup.open}
          typedName={websiteDup.typedValue}
          candidates={websiteDup.candidates}
          linkLabel="Use This Startup"
          createLabel="Add Anyway"
          onCancel={websiteDup.close}
          onLinkExisting={(c) => linkExisting(c.id)}
          onCreatePendingAnyway={websiteDup.close}
        />
      </DialogContent>
    </Dialog>
  );
}

function SnapshotTagRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-border/60 bg-background px-1.5 py-px text-[10px] font-medium text-foreground/75"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
