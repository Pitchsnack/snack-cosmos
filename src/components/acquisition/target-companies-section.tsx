import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CompanyFormDialog,
  type CompanyFormValue,
} from "@/components/acquisition/company-form-dialog";
import { CompanyTable } from "@/components/acquisition/company-table";
import { newId, type AcquisitionStrategy, type TargetCompany } from "@/lib/acquisition/strategy-store";

type Updater = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => void;

export function TargetCompaniesSection({
  strategy,
  update,
  canEdit,
  expanded = false,
  numberedTitle,
  description,
  onOpenLinked,
  onOpenCompany,
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
  /** Opens the information panel for a manual (unlinked) company. */
  onOpenCompany?: (item: TargetCompany) => void;
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
      return { ...d, targets: [...d.targets, { id: newId(), ...value }] };
    });
    toast.success(editing ? "Target company updated" : "Target company added");
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
        <div className="mt-4">
          <CompanyTable
            items={targets}
            canEdit={canEdit}
            onEdit={(t: TargetCompany) => openEdit(t)}
            onDelete={(t: TargetCompany) => remove(t)}
            onOpenLinked={onOpenLinked}
            onOpenCompany={onOpenCompany ? (i) => onOpenCompany(i as TargetCompany) : undefined}
          />
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
