import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTr } from "@/components/common/edit-info-popup";

export interface UnsavedChangesDialogProps {
  open: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
  saving?: boolean;
  canSave?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscard,
  onSave,
  saving,
  canSave = true,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // ESC / outside-click behave as Continue Editing — never discard.
        if (!next) onContinueEditing();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Do you want to save before leaving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onContinueEditing} disabled={saving}>
            {tr("Continue Editing", "แก้ไขต่อ")}
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={saving}>
            {tr("Discard Changes", "ทิ้งการเปลี่ยนแปลง")}
          </Button>
          <Button onClick={onSave} disabled={saving || !canSave}>
            {saving ? tr("Saving…", "กำลังบันทึก…") : tr("Save Changes", "บันทึกการเปลี่ยนแปลง")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
