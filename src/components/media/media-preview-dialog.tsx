import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  url: string | null;
  onClose: () => void;
}

/** Full-size image preview modal. ESC + overlay click close it (Radix default). */
export function MediaPreviewDialog({ url, onClose }: Props) {
  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[840px] p-2">
        {url && (
          <img
            src={url}
            alt="Media preview"
            className="w-full max-h-[533px] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
