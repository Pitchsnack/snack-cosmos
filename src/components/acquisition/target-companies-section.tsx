import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { newId, type AcquisitionStrategy, type TargetCompany } from "@/lib/acquisition/strategy-store";

const EMPTY_TARGET = { name: "", website: "", source: "", notes: "" };

type Updater = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => void;

export function TargetCompaniesSection({
  strategy,
  update,
  canEdit,
  expanded = false,
  numberedTitle,
  description,
}: {
  strategy: AcquisitionStrategy;
  update: Updater;
  canEdit: boolean;
  /** Expanded tab view: adds search + section framing. */
  expanded?: boolean;
  numberedTitle?: string;
  description?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TargetCompany | null>(null);
  const [form, setForm] = useState(EMPTY_TARGET);
  const [query, setQuery] = useState("");

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return strategy.targets;
    return strategy.targets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.website.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q),
    );
  }, [strategy.targets, query]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_TARGET);
    setDialogOpen(true);
  };
  const openEdit = (t: TargetCompany) => {
    setEditing(t);
    setForm({ name: t.name, website: t.website, source: t.source, notes: t.notes });
    setDialogOpen(true);
  };
  const save = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Company name is required");
      return;
    }
    update((d) => {
      if (editing) {
        return {
          ...d,
          targets: d.targets.map((t) =>
            t.id === editing.id
              ? { ...t, name, website: form.website.trim(), source: form.source.trim(), notes: form.notes.trim() }
              : t,
          ),
        };
      }
      return {
        ...d,
        targets: [
          ...d.targets,
          { id: newId(), name, website: form.website.trim(), source: form.source.trim(), notes: form.notes.trim() },
        ],
      };
    });
    setDialogOpen(false);
    toast.success(editing ? "Target company updated" : "Target company added");
  };
  const remove = (t: TargetCompany) => {
    update((d) => ({ ...d, targets: d.targets.filter((x) => x.id !== t.id) }));
    toast.success(`Removed ${t.name}`);
  };

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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Company Name</th>
                <th className="pb-2 pr-4 font-medium">Website</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Notes</th>
                {canEdit && <th className="pb-2 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {t.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    {t.website ? (
                      <a
                        href={/^https?:\/\//i.test(t.website) ? t.website : `https://${t.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-900 hover:underline"
                      >
                        {t.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {t.source ? (
                      <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                        {t.source}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] py-2.5 pr-4">
                    <span className="line-clamp-2 text-xs text-muted-foreground">{t.notes || "—"}</span>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Target Company" : "Add Target Company"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tc-name">Company Name</Label>
              <Input
                id="tc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. GreenTech Solutions"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-website">Website</Label>
              <Input
                id="tc-website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-source">Source</Label>
              <Input
                id="tc-source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="e.g. Internal Research, Leadership Direction"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-notes">Notes</Label>
              <Textarea
                id="tc-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Why this company is an attractive target…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Company"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
