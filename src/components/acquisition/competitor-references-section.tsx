import { useState } from "react";
import { Bot, ChevronDown, ExternalLink, Plus, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  EXTRACTION_STATUS_LABEL,
  MAX_COMPETITORS,
  newId,
  simulateExtraction,
  type AcquisitionStrategy,
  type CompetitorReference,
  type ExtractionStatus,
} from "@/lib/acquisition/strategy-store";

type Updater = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => void;

const STATUS_TONE: Record<ExtractionStatus, string> = {
  not_extracted: "border-transparent bg-muted/60 text-muted-foreground",
  pending: "border-accent/40 bg-accent/10 text-accent-foreground",
  extracted: "border-primary/30 bg-primary/5 text-primary",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function CompetitorReferencesSection({
  strategy,
  update,
  canEdit,
  expanded = false,
  numberedTitle,
}: {
  strategy: AcquisitionStrategy;
  update: Updater;
  canEdit: boolean;
  /** Expanded tab view: shows per-competitor extraction results. */
  expanded?: boolean;
  numberedTitle?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", website: "" });
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});

  const atLimit = strategy.competitors.length >= MAX_COMPETITORS;

  const addCompetitor = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Competitor name is required");
      return;
    }
    update((d) => ({
      ...d,
      competitors: [
        ...d.competitors,
        { id: newId(), name, website: form.website.trim(), status: "not_extracted", lastExtractedAt: null, result: null },
      ],
    }));
    setDialogOpen(false);
    setForm({ name: "", website: "" });
    toast.success("Competitor reference added");
  };

  const remove = (c: CompetitorReference) => {
    update((d) => ({ ...d, competitors: d.competitors.filter((x) => x.id !== c.id) }));
    toast.success(`Removed ${c.name}`);
  };

  /** Simulated AI extraction — user inputs stay limited to Name + Website. */
  const extract = (c: CompetitorReference) => {
    if (c.status === "pending") return;
    update((d) => ({
      ...d,
      competitors: d.competitors.map((x) => (x.id === c.id ? { ...x, status: "pending" } : x)),
    }));
    setTimeout(() => {
      update((d) => ({
        ...d,
        competitors: d.competitors.map((x) =>
          x.id === c.id
            ? {
                ...x,
                status: "extracted",
                lastExtractedAt: new Date().toISOString(),
                result: simulateExtraction(x.name, x.website),
              }
            : x,
        ),
      }));
      toast.success(`Acquisition patterns extracted for ${c.name}`);
    }, 1500);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            {numberedTitle ?? "Competitor Acquisition References"}{" "}
            <span className="font-normal text-muted-foreground">(Optional)</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add up to 3 competitors for which we want to analyze acquisition history and patterns.
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            disabled={atLimit}
            title={atLimit ? "Maximum of 3 competitor references reached" : undefined}
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Competitor (Up to 3)
          </Button>
        )}
      </div>

      {strategy.competitors.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          No competitor references added yet. Add up to 3 competitors and extract their acquisition
          patterns.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="hidden grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] gap-4 border-b border-border/60 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
            <span>Competitor Name</span>
            <span>Website</span>
            <span>AI Extraction Status</span>
            <span>Last Extracted</span>
            <span className="text-right">Actions</span>
          </div>
          {strategy.competitors.map((c) => {
            const resultsOpen = !!openResults[c.id];
            return (
              <div key={c.id} className="rounded-md border border-border/50">
                <div className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] md:gap-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {c.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div>
                    {c.website ? (
                      <a
                        href={/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-900 hover:underline"
                      >
                        {c.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        STATUS_TONE[c.status],
                      )}
                    >
                      {c.status === "pending" && (
                        <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                      )}
                      {EXTRACTION_STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.lastExtractedAt ? new Date(c.lastExtractedAt).toLocaleString() : "—"}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={c.status === "pending"}
                        onClick={() => extract(c)}
                      >
                        <Bot className="mr-1 h-3.5 w-3.5" />
                        {c.status === "extracted" ? "Re-extract" : "Extract"}
                      </Button>
                    )}
                    {expanded && c.result && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={resultsOpen ? "Hide extraction results" : "Show extraction results"}
                        onClick={() => setOpenResults((s) => ({ ...s, [c.id]: !s[c.id] }))}
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", resultsOpen && "rotate-180")}
                        />
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => remove(c)}
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {expanded && resultsOpen && c.result && (
                  <div className="grid gap-4 border-t border-border/50 bg-muted/20 px-4 py-4 sm:grid-cols-2">
                    <ResultBlock title="Acquisition History" items={c.result.acquisitionHistory} ordered />
                    <ResultBlock title="Acquired Companies" items={c.result.acquiredCompanies} />
                    <ResultBlock title="Common Themes" items={c.result.commonThemes} chips />
                    <ResultBlock title="Strategic Patterns" items={c.result.strategicPatterns} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && strategy.competitors.length > 0 && !atLimit && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Competitor (Up to 3)
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competitor Reference</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Only the competitor name and website are needed — acquisition history, targets and
            patterns are discovered automatically by the Extract action.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cr-name">Competitor Name</Label>
              <Input
                id="cr-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Competitor A"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-website">Website</Label>
              <Input
                id="cr-website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://competitor.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCompetitor}>Add Competitor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ResultBlock({
  title,
  items,
  chips = false,
  ordered = false,
}: {
  title: string;
  items: string[];
  chips?: boolean;
  ordered?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {chips ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-foreground/85"
            >
              {it}
            </span>
          ))}
        </div>
      ) : (
        <ul className={cn("space-y-1 text-xs text-foreground/80", ordered ? "list-decimal" : "list-disc", "pl-4")}>
          {items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
