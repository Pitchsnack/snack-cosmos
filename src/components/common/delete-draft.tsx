/**
 * My Company ⋮ menu "Delete draft": red when the draft can be deleted, greyed out
 * otherwise, plus the confirm pop-up. The dialog is rendered by the host component
 * (outside the dropdown) so it survives the menu closing — see CompanyMenu.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteDraftProfile, deleteDraftState } from "@/lib/delete-draft.functions";
import { tr } from "@/i18n/language";
import type { DraftKind, DraftDeleteState } from "@/lib/delete-draft";

export type DeleteDraftTarget = {
  kind: DraftKind;
  id: string;
  /** Display name for the confirm line; empty/whitespace shows the untitled wording. */
  name: string;
  /** Query keys to invalidate after a successful delete. */
  invalidate: readonly (readonly unknown[])[];
  /** Extra cleanup after a successful delete (e.g. select the next profile). */
  onDeleted?: () => void;
};

export function useDraftDeleteState(kind: DraftKind, id: string) {
  return useQuery({
    queryKey: ["draft-delete-state", kind, id],
    queryFn: () => deleteDraftState({ data: { kind, id } }),
    staleTime: 15_000,
  });
}

/** The menu row. Greyed out (focusable, click does nothing) when the state says no. */
export function DeleteDraftMenuItem({ state, onPick }: { state: DraftDeleteState | undefined; onPick: () => void }) {
  const deletable = state?.deletable ?? false;
  return (
    <DropdownMenuItem
      aria-disabled={!deletable}
      onSelect={(e) => {
        e.preventDefault();
        if (deletable) onPick();
      }}
      className={
        deletable
          ? "!h-auto cursor-pointer items-start !whitespace-normal text-[#B91C1C] focus:bg-[#FEF2F2] focus:text-[#B91C1C] dark:text-red-400 dark:focus:bg-red-950/40"
          : "!h-auto cursor-not-allowed items-start !whitespace-normal text-[#9CA3AF] focus:bg-transparent focus:text-[#9CA3AF]"
      }
    >
      <span className="flex items-start gap-2.5">
        <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block">{tr("Delete draft")}</span>
          {state?.reason === "active" && (
            <span className="mt-0.5 block text-[12px] font-normal leading-snug text-[#6B7280] dark:text-muted-foreground">
              {tr("Can't delete: it has an active NDA or deal.")}
            </span>
          )}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

/** The confirm pop-up. Render outside the dropdown menu; focus starts on Cancel. */
export function DeleteDraftDialog({ target, onClose }: { target: DeleteDraftTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const name = target?.name.trim() ?? "";

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await deleteDraftProfile({ data: { kind: target.kind, id: target.id } });
      onClose();
      toast.success(tr("Draft deleted."));
      for (const key of target.invalidate) await qc.invalidateQueries({ queryKey: key as unknown[] });
      target.onDeleted?.();
    } catch {
      onClose();
      toast.error(tr("This draft can't be deleted: it has been submitted, or it has active deals or NDAs."));
      void qc.invalidateQueries({ queryKey: ["draft-delete-state", target.kind, target.id] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        className="w-[440px] max-w-[calc(100vw-32px)] rounded-2xl p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-[18px] font-bold">{tr("Delete this draft?")}</DialogTitle>
          <DialogDescription className="text-[14px] text-[#4B5563] dark:text-muted-foreground">
            {name
              ? tr("{name} and everything in it will be deleted. This can't be undone.").replace("{name}", name)
              : tr("This untitled draft and everything in it will be deleted. This can't be undone.")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" autoFocus onClick={onClose} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button
            className="bg-[#B91C1C] text-white hover:bg-[#991B1B] dark:bg-red-700 dark:hover:bg-red-800"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? tr("Deleting…") : tr("Delete draft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Menu item + dialog wired together; the host renders `<DeleteDraftHost>` once, outside any dropdown. */
export function useDeleteDraftHost() {
  const [target, setTarget] = useState<DeleteDraftTarget | null>(null);
  return {
    askDelete: (t: DeleteDraftTarget) => setTarget(t),
    dialog: <DeleteDraftDialog target={target} onClose={() => setTarget(null)} />,
  };
}
