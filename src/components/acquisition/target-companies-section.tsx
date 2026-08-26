import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CompanyFormDialog,
  type CompanyFormValue,
} from "@/components/acquisition/company-form-dialog";
import {
  newId,
  TARGET_SOURCES,
  type AcquisitionStrategy,
  type TargetCompany,
  type TargetSource,
} from "@/lib/acquisition/strategy-store";

const SOURCE_TONE: Record<TargetSource, string> = {
  "Internal Research": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Leadership Direction": "border-purple-200 bg-purple-50 text-purple-700",
};

type Updater = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => void;

export function TargetCompaniesSection({
  strategy,
  update,
  canEdit,
  expanded = false,
  numberedTitle,
  description,
  onOpenLinked,
}: {
  strategy: AcquisitionStrategy;
  update: Updater;
  canEdit: boolean;
  /** Expanded tab view: adds search + section framing. */
  expanded?: boolean;
  numberedTitle?: string;
  description?: string;
  /** Opens a linked startup's information panel as an overlay on this page. */
  onOpenLinked?: (startupId: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TargetCompany | null>(null);
  const [query, setQuery] = useState("");

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return strategy.targets;
    return strategy.targets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.website.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.attractiveKeywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [strategy.targets, query]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (t: TargetCompany) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const save = (value: CompanyFormValue) => {
    update((d) => {
      if (editing) {
        return {
          ...d,
          targets: d.targets.map((t) => (t.id === editing.id ? { ...t, ...value } : t)),
        };
      }
      return {
        ...d,
        targets: [...d.targets, { id: newId(), source: "Internal Research" as TargetSource, ...value }],
      };
    });
    toast.success(editing ? "Target company updated" : "Target company added");
  };

  /** Source is a single pill; click cycles it between the two allowed values. */
  const cycleSource = (t: TargetCompany) => {
    const next = TARGET_SOURCES[(TARGET_SOURCES.indexOf(t.source) + 1) % TARGET_SOURCES.length];
    update((d) => ({
      ...d,
      targets: d.targets.map((x) => (x.id === t.id ? { ...x, source: next } : x)),
    }));
  };

  const remove = (t: TargetCompany) => {
    update((d) => ({ ...d, targets: d.targets.filter((x) => x.id !== t.id) }));
    toast.success(`Removed ${t.name}`);
  };

  const dialogInitial: CompanyFormValue | null = editing
    ? {
        name: editing.name,
        website: editing.website,
        logo: editing.logo,
        attractiveKeywords: editing.attractiveKeywords,
        notes: editing.notes,
        linkedStartupId: editing.linkedStartupId,
        linkedSnapshot: editing.linkedSnapshot,
      }
    : null;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            {numberedTitle ?? "Companies We Want to Acquire"}
            <InfoTip text="Specific companies this startup is actively interested in acquiring. Private to this workspace." />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {description ?? "List specific companies that we are actively interested in acquiring."}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Target Company
          </Button>
        )}
      </div>

      {expanded && strategy.targets.length > 0 && (
        <div className="relative mt-3 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search target companies…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}

      {targets.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          {strategy.targets.length === 0
            ? "No target companies added yet. Add companies the startup would like to acquire."
            : "No companies match your search."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Company Name</th>
                <th className="pb-2 pr-4 font-medium">Website</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Notes</th>
                {canEdit && <th className="pb-2 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="h-14 border-b border-border/40 last:border-0">

                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {t.logo ? (
                        <img
                          src={t.logo}
                          alt={`${t.name} logo`}
                          className="h-7 w-7 shrink-0 rounded-md border border-border/60 bg-background object-contain"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {t.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        {t.linkedStartupId ? (
                          <button
                            type="button"
                            onClick={() => onOpenLinked?.(t.linkedStartupId!)}
                            className="font-medium text-blue-900 hover:underline"
                            title="View the linked startup record"
                          >
                            {t.name}
                          </button>
                        ) : (
                          <span className="font-medium">{t.name}</span>
                        )}
                        {t.linkedStartupId && (
                          <button
                            type="button"
                            onClick={() => onOpenLinked?.(t.linkedStartupId!)}
                            title="View the linked startup record"
                            className="ml-1.5 rounded-full border border-primary/25 bg-primary/5 px-1.5 py-px text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            Linked
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    {t.website ? (
                      <a
                        href={/^https?:\/\//i.test(t.website) ? t.website : `https://${t.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-900 hover:underline"
                      >
                        {t.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => cycleSource(t)}
                        title="Click to switch source"
                        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${SOURCE_TONE[t.source]}`}
                      >
                        {t.source}
                      </button>
                    ) : (
                      <span
                        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${SOURCE_TONE[t.source]}`}
                      >
                        {t.source}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[260px] py-2.5 pr-4">
                    <span className="block truncate text-xs text-muted-foreground">{t.notes || "—"}</span>
                  </td>

                  {canEdit && (
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => remove(t)}
                          aria-label={`Delete ${t.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && targets.length > 0 && (
        <button
          type="button"
          onClick={openAdd}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Target Company
        </button>
      )}

      <CompanyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit Target Company" : "Add Target Company"}
        submitLabel={editing ? "Save Changes" : "Add Company"}
        nameLabel="Company Name"
        namePlaceholder="e.g. GreenTech Solutions"
        initial={dialogInitial}
        onSave={save}
      />
    </section>
  );
}
