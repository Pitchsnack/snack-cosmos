import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { EnrichStartupResult } from "@/lib/auto-enrich/auto-enrich-adapter";

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
}

export const EMPTY_COMPANY_FORM: CompanyFormValue = {
  name: "",
  website: "",
  logo: null,
  attractiveKeywords: [],
  notes: "",
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

/**
 * Shared Add/Edit dialog for acquisition-strategy companies (target
 * companies and competitor references). Composition:
 *   Name → Website (P-18 duplicate check) → Logo (drag&drop/upload/snip)
 *   → ✨ Auto Enrich → Why attractive (≤5 keyword pills) → Notes
 * Auto Enrich only fills fields the user left empty — it never overwrites
 * user-entered information.
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
    });
    setLogoSlot(init.logo ? { ...EMPTY_SLOT, signedUrl: init.logo } : EMPTY_SLOT);
    setSaving(false);
  }, [open, initial]);

  const onEnriched = (result: EnrichStartupResult) => {
    setForm((f) => {
      let next = f;
      // Only fill empty fields — never overwrite user-entered information.
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
        logo = logoSlot.signedUrl; // data URL or remote favicon suggestion
      }
      onSave({
        name,
        website: form.website.trim(),
        logo,
        attractiveKeywords: form.attractiveKeywords.slice(0, MAX_ATTRACTIVE_KEYWORDS),
        notes: form.notes.trim(),
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

          <div className="space-y-1.5">
            <Label>
              Why this company is attractive{" "}
              <span className="font-normal text-muted-foreground">
                (up to {MAX_ATTRACTIVE_KEYWORDS} keywords)
              </span>
            </Label>
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
          onCancel={websiteDup.close}
          onLinkExisting={(c) => {
            websiteDup.close();
            if (c.id) window.open(`/startups/${c.id}`, "_blank", "noopener,noreferrer");
          }}
          onCreatePendingAnyway={websiteDup.close}
        />
      </DialogContent>
    </Dialog>
  );
}
