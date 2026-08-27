import { useState } from "react";
import { Bot, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CompanyFormDialog,
  type CompanyFormValue,
} from "@/components/acquisition/company-form-dialog";
import { CompanyTable } from "@/components/acquisition/company-table";
import { InfoHint } from "@/components/acquisition/info-hint";
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
  onOpenLinked,
}: {
  strategy: AcquisitionStrategy;
  update: Updater;
  canEdit: boolean;
  /** Expanded tab view: shows per-competitor extraction results. */
  expanded?: boolean;
  numberedTitle?: string;
  /** Opens a linked startup's information panel as an overlay on this page. */
  onOpenLinked?: (startupId: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompetitorReference | null>(null);
  const [openResults, setOpenResults] = useState<Record<string, boolean>>({});

  const atLimit = strategy.competitors.length >= MAX_COMPETITORS;

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: CompetitorReference) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const save = (value: CompanyFormValue) => {
    update((d) => {
      if (editing) {
        return {
          ...d,
          competitors: d.competitors.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: value.name,
                  website: value.website,
                  logo: value.logo,
                  attractiveKeywords: value.attractiveKeywords,
                  notes: value.notes,
                  linkedStartupId: value.linkedStartupId,
                  linkedSnapshot: value.linkedSnapshot,
                }
              : c,
          ),
        };
      }
      return {
        ...d,
        competitors: [
          ...d.competitors,
          {
            id: newId(),
            name: value.name,
            website: value.website,
            logo: value.logo,
            attractiveKeywords: value.attractiveKeywords,
            notes: value.notes,
            linkedStartupId: value.linkedStartupId,
            linkedSnapshot: value.linkedSnapshot,
            status: "not_extracted",
            lastExtractedAt: null,
            result: null,
          },
        ],
      };
    });
    toast.success(editing ? "Competitor reference updated" : "Competitor reference added");
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
          <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            {numberedTitle ?? "Competitor Acquisition References"}
            <InfoHint text="Competitors whose acquisition history we analyse to learn what kinds of companies they buy." />
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
            onClick={() => openAdd()}
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
        <div className="mt-4">
          <CompanyTable
            items={strategy.competitors}
            canEdit={canEdit}
            onEdit={(c: CompetitorReference) => openEdit(c)}
            onDelete={(c: CompetitorReference) => remove(c)}
            onOpenLinked={onOpenLinked}
            keywordClassName="border-emerald-600/25 bg-emerald-600/10 text-emerald-800"
            renderStatusPill={(item) => {
              const c = item as CompetitorReference;
              if (c.status === "extracted") return null;
              return (
                <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                  {c.status === "pending" ? "Extraction Running" : "Extraction Pending"}
                </span>
              );
            }}
            renderExtra={
              expanded
                ? (item) => {
                    const c = item as CompetitorReference;
                    const resultsOpen = !!openResults[c.id];
                    return (
                      <div className="rounded-md border border-border/50 bg-muted/20">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                                STATUS_TONE[c.status],
                              )}
                            >
                              {c.status === "pending" && (
                                <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                              )}
                              {EXTRACTION_STATUS_LABEL[c.status]}
                            </span>
                            <span>
                              Last extracted:{" "}
                              {c.lastExtractedAt
                                ? new Date(c.lastExtractedAt).toLocaleString()
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
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
                            {c.result && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                aria-label={
                                  resultsOpen ? "Hide extraction results" : "Show extraction results"
                                }
                                onClick={() =>
                                  setOpenResults((s) => ({ ...s, [c.id]: !s[c.id] }))
                                }
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    resultsOpen && "rotate-180",
                                  )}
                                />
                              </Button>
                            )}
                          </div>
                        </div>
                        {resultsOpen && c.result && (
                          <div className="grid gap-4 border-t border-border/50 px-4 py-4 sm:grid-cols-2">
                            <ResultBlock
                              title="Acquisition History"
                              items={c.result.acquisitionHistory}
                              ordered
                            />
                            <ResultBlock
                              title="Acquired Companies"
                              items={c.result.acquiredCompanies}
                            />
                            <ResultBlock title="Common Themes" items={c.result.commonThemes} chips />
                            <ResultBlock
                              title="Strategic Patterns"
                              items={c.result.strategicPatterns}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }
                : undefined
            }
          />
        </div>
      )}


      {canEdit && strategy.competitors.length > 0 && !atLimit && (
        <button
          type="button"
          onClick={() => openAdd()}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Competitor (Up to 3)
        </button>
      )}

      <CompanyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit Competitor Reference" : "Add Competitor Reference"}
        description={
          editing
            ? "Update the competitor's details — acquisition history, targets and patterns are discovered automatically by the Extract action."
            : "Add the competitor's details — acquisition history, targets and patterns are discovered automatically by the Extract action."
        }
        submitLabel={editing ? "Save Changes" : "Add Competitor"}
        nameLabel="Competitor Name"
        namePlaceholder="e.g. Competitor A"
        initial={
          editing
            ? {
                name: editing.name,
                website: editing.website,
                logo: editing.logo,
                attractiveKeywords: editing.attractiveKeywords,
                notes: editing.notes,
                linkedStartupId: editing.linkedStartupId,
                linkedSnapshot: editing.linkedSnapshot,
              }
            : null
        }
        onSave={save}
      />
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
