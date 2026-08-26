import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { TagInput } from "@/components/acquisition/tag-input";
import {
  EMPTY_REQUIREMENTS,
  type AcquisitionRequirements,
  type AcquisitionStrategy,
} from "@/lib/acquisition/strategy-store";
import type { StartupDetail } from "@/lib/startups.functions";

type Updater = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => void;

const STAGE_SUGGESTIONS = ["Seed", "Early Stage", "Growth", "Mature", "Pre-IPO"];
const SIZE_SUGGESTIONS = ["1–20 employees", "20–200 employees", "200–1,000 employees", "1,000+ employees"];

type Tone = "green" | "blue" | "purple" | "orange" | "amber" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  muted: "border-border bg-muted/50 text-muted-foreground",
};

const MAX_VISIBLE_TAGS = 3;

function ChipGroup({ label, tags, tone }: { label: string; tags: string[]; tone: Tone }) {
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflow = tags.length - visible.length;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</h4>
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((t) => (
            <span
              key={t}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLASS[tone]}`}
            >
              {t}
            </span>
          ))}
          {overflow > 0 && (
            <span
              title={tags.slice(MAX_VISIBLE_TAGS).join(", ")}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLASS.muted}`}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function isEmpty(r: AcquisitionRequirements): boolean {
  return (
    r.industries.length === 0 &&
    r.keywords.length === 0 &&
    r.productTags.length === 0 &&
    r.markets.length === 0 &&
    r.stages.length === 0 &&
    r.companySize.trim() === "" &&
    r.strategicReason.trim() === ""
  );
}

/** Suggested prefill derived from the startup's own profile. */
function suggestionsFromStartup(startup: StartupDetail | undefined) {
  return {
    industries: startup?.industry ?? [],
    productTags: startup?.product_tags ?? [],
    markets: startup?.market_tags ?? [],
    stages: startup?.investment_stage ? [startup.investment_stage] : [],
  };
}

/** Shared edit form — used by the overview dialog and the Requirements tab. */
export function RequirementsForm({
  value,
  onChange,
  startup,
}: {
  value: AcquisitionRequirements;
  onChange: (next: AcquisitionRequirements) => void;
  startup?: StartupDetail;
}) {
  const sug = suggestionsFromStartup(startup);
  const set = (patch: Partial<AcquisitionRequirements>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Industries</Label>
        <TagInput
          value={value.industries}
          onChange={(industries) => set({ industries })}
          placeholder="e.g. FoodTech, AgriTech"
          suggestions={sug.industries}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Keywords</Label>
        <TagInput
          value={value.keywords}
          onChange={(keywords) => set({ keywords })}
          placeholder="e.g. AI, Automation"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Product &amp; Service Tags</Label>
        <TagInput
          value={value.productTags}
          onChange={(productTags) => set({ productTags })}
          placeholder="e.g. Route Optimisation"
          suggestions={sug.productTags}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Markets</Label>
        <TagInput
          value={value.markets}
          onChange={(markets) => set({ markets })}
          placeholder="e.g. Thailand, Southeast Asia"
          suggestions={sug.markets}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Company Stage</Label>
        <TagInput
          value={value.stages}
          onChange={(stages) => set({ stages })}
          placeholder="e.g. Growth, Mature"
          suggestions={[...new Set([...sug.stages, ...STAGE_SUGGESTIONS])]}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="req-size">Company Size</Label>
        <Input
          id="req-size"
          value={value.companySize}
          onChange={(e) => set({ companySize: e.target.value })}
          placeholder="e.g. 20–200 employees"
          list="req-size-suggestions"
        />
        <datalist id="req-size-suggestions">
          {SIZE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="req-reason">Strategic Reason</Label>
        <Textarea
          id="req-reason"
          value={value.strategicReason}
          onChange={(e) => set({ strategicReason: e.target.value })}
          placeholder="e.g. Expand product capability, acquire technology, and enter new markets."
          rows={3}
        />
      </div>
    </div>
  );
}

/** Overview summary: read-only chips + Edit Requirements dialog. */
export function RequirementsSection({
  strategy,
  update,
  startup,
  canEdit,
  numberedTitle,
}: {
  strategy: AcquisitionStrategy;
  update: Updater;
  startup?: StartupDetail;
  canEdit: boolean;
  numberedTitle?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<AcquisitionRequirements>(EMPTY_REQUIREMENTS);
  const r = strategy.requirements;
  const empty = isEmpty(r);

  const openEdit = () => {
    // Prefill from the startup profile when nothing has been defined yet.
    const sug = suggestionsFromStartup(startup);
    setDraft(
      empty
        ? {
            ...EMPTY_REQUIREMENTS,
            industries: sug.industries,
            productTags: sug.productTags,
            markets: sug.markets,
          }
        : { ...r },
    );
    setDialogOpen(true);
  };

  const save = () => {
    update((d) => ({ ...d, requirements: draft }));
    setDialogOpen(false);
    toast.success("Acquisition requirements saved");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            {numberedTitle ?? "Acquisition Requirements"}
            <InfoTip text="Criteria used to discover ideal acquisition targets: industries, keywords, product tags, markets, stage and size." />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Define the types of companies we want to find and acquire.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Requirements
          </Button>
        )}
      </div>

      {empty ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          No acquisition requirements defined yet. Add criteria to help identify acquisition
          targets.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <ChipGroup label="Industries" tags={r.industries} tone="green" />
          <ChipGroup label="Keywords" tags={r.keywords} tone="blue" />
          <ChipGroup label="Product & Service Tags" tags={r.productTags} tone="purple" />
          <ChipGroup label="Markets" tags={r.markets} tone="orange" />
          <ChipGroup label="Company Stage" tags={r.stages} tone="amber" />
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Company Size</h4>
            {r.companySize ? (
              <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                {r.companySize}
              </span>
            ) : (
              <p className="text-xs text-muted-foreground/70">—</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Strategic Reason</h4>
            <p className="text-xs leading-relaxed text-foreground/80">{r.strategicReason || "—"}</p>
          </div>

        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Acquisition Requirements</DialogTitle>
          </DialogHeader>
          <RequirementsForm value={draft} onChange={setDraft} startup={startup} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Requirements</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
