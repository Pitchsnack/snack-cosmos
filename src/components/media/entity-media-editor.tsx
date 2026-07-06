import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon, Upload, X, ZoomIn, Loader2, Lock, Unlock, Camera, Crop,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateImageFile, formatFileSize } from "@/lib/media/image-validation";
import {
  mediaCaptureAdapter,
  type CapturedMediaResult,
  type SlotNumber,
} from "@/lib/media/media-capture-adapter";
import { SnippingCapture } from "@/components/media/snipping-capture";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";

/**
 * Shared remove-X button. Only rendered when the tile has an image.
 * Destructive red, keyboard focusable, scales on hover/focus-visible,
 * opens the parent-owned confirmation dialog.
 */
function RemoveXButton({
  onActivate,
  ariaLabel,
  title,
  iconSizeClass,
  paddingClass,
  positionClass,
}: {
  onActivate: () => void;
  ariaLabel: string;
  title: string;
  iconSizeClass: string;
  paddingClass: string;
  positionClass: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onActivate();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "absolute rounded-full bg-destructive text-destructive-foreground shadow",
        "hover:bg-destructive/90 origin-center transform-gpu transition-transform",
        "hover:scale-110 focus-visible:scale-110",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        paddingClass,
        positionClass,
      )}
    >
      <X className={iconSizeClass} />
    </button>
  );
}


/** Confirmation dialog shared by logo + slot tiles. */
function RemoveConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  onConfirm,
  previewUrl,
  previewAlt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  onConfirm: () => void;
  previewUrl?: string | null;
  previewAlt?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {previewUrl ? (
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt={previewAlt ?? "Image to remove"}
              className="max-w-full max-h-[220px] rounded-md border object-contain bg-muted"
            />
          </div>
        ) : null}
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Slot preview modal — shows the enlarged image with Cancel/Delete actions.
 * No corner-X close control (per spec). ESC / overlay click = Cancel.
 * Delete does NOT remove immediately — it hands off to a confirmation dialog.
 */
function SlotPreviewDialog({
  open, onOpenChange, url, alt, onRequestDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string | null;
  alt: string;
  onRequestDelete: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[840px]">
        <AlertDialogHeader className="sr-only">
          <AlertDialogTitle>Image preview</AlertDialogTitle>
          <AlertDialogDescription>Preview the selected media image.</AlertDialogDescription>
        </AlertDialogHeader>
        {url && (
          <img
            src={url}
            alt={alt}
            className="w-full max-h-[520px] object-contain rounded-lg bg-muted"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); onRequestDelete(); }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Visual logo + 3-slot media editor. Reusable across entities (startups,
 * investors, …). Persistence stays with the parent form; this component
 * only tracks intended state per slot and stages `pendingFile` for the
 * parent's save-time upload.
 */
export interface SlotState {
  /** path in the storage bucket (e.g. "<tenantId>/<entityId>/<filename>"). */
  persistedPath: string | null;
  /** signed URL for `persistedPath`, if known. */
  signedUrl: string | null;
  /** file the user picked but hasn't saved yet — wins over signedUrl in preview. */
  pendingFile: File | null;
  /** local-only lock. Prevents Screenshot from overwriting this slot. */
  isLocked?: boolean;
}

export const EMPTY_SLOT: SlotState = {
  persistedPath: null, signedUrl: null, pendingFile: null, isLocked: false,
};

export interface EntityMediaState {
  logo: SlotState;
  slots: [SlotState, SlotState, SlotState];
}

export const EMPTY_MEDIA_STATE: EntityMediaState = {
  logo: EMPTY_SLOT,
  slots: [EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT],
};

interface Props {
  value: EntityMediaState;
  onChange: (next: EntityMediaState) => void;
  /**
   * Optional Screenshot integration. When omitted the Screenshot button is
   * hidden — keeps the editor reusable for investor forms that have no
   * website-screenshot flow. Snip From Screen is browser-based and stays
   * available whenever `getDisplayMedia` is supported.
   */
  screenshot?: {
    websiteUrl?: string | null;
  };
}

export function EntityMediaEditor({ value, onChange, screenshot }: Props) {
  const setLogo = (logo: SlotState) => onChange({ ...value, logo });
  const setSlot = (i: number, slot: SlotState) => {
    const next = [...value.slots] as [SlotState, SlotState, SlotState];
    next[i] = slot;
    onChange({ ...value, slots: next });
  };

  return (
    <div className="flex items-start gap-10 flex-wrap">
      <LogoSlot value={value.logo} onChange={setLogo} />
      <MediaSlots
        value={value.slots}
        onChange={setSlot}
        screenshot={screenshot}
        onSetAllSlots={(next) => onChange({ ...value, slots: next })}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

function usePreview(slot: SlotState): string | null {
  const blob = useMemo(
    () => (slot.pendingFile ? URL.createObjectURL(slot.pendingFile) : null),
    [slot.pendingFile],
  );
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  return blob ?? slot.signedUrl;
}

/** Thumbnail with skeleton placeholder while the image is loading. */
function ImageWithSkeleton({ src, alt, width, height, className }: {
  src: string; alt: string; width: number; height: number; className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [src]);
  return (
    <div className="relative" style={{ width, height }}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-md" />}
      <img
        src={src}
        alt={alt}
        className={cn(
          "rounded-md border border-border transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        style={{ width, height }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function fileMetaBadge(slot: SlotState): { ext: string | null; size: number | null } {
  if (slot.pendingFile) {
    const ext = slot.pendingFile.name.split(".").pop()?.toLowerCase() ?? null;
    return { ext, size: slot.pendingFile.size };
  }
  const path = slot.persistedPath ?? slot.signedUrl ?? "";
  const ext = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? null;
  const allowed = ext && ["webp", "png", "jpg", "jpeg", "svg", "gif"].includes(ext) ? ext : null;
  return { ext: allowed, size: null };
}

/* -------------------------------------------------------------------------- */
/*  Logo                                                                      */
/* -------------------------------------------------------------------------- */

function LogoSlot({ value, onChange }: { value: SlotState; onChange: (s: SlotState) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [snipOpen, setSnipOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preview = usePreview(value);


  const supportsSnip =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  const pick = (f: File) => {
    const v = validateImageFile(f);
    if (!v.valid) { toast.error(v.error ?? "Invalid file"); return; }
    onChange({ ...value, pendingFile: f });
  };
  const clear = () => onChange({ persistedPath: null, signedUrl: null, pendingFile: null, isLocked: false });

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      <div
        className={`flex items-center gap-4 rounded-lg p-2 -m-2 transition-colors ${
          dragging ? "bg-accent/50 ring-2 ring-primary/30" : ""
        }`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) pick(f);
        }}
      >
        {preview ? (
          <div className="relative group">
            <img
              src={preview}
              alt="Logo"
              className="w-[168px] h-[56px] rounded-lg object-contain border border-border group-hover:opacity-60 transition-opacity"
            />
            <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewUrl(preview); }}
                className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
                title="Preview"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
                className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
                title="Replace"
              >
                <Upload className="h-3 w-3" />
              </button>
              {supportsSnip && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSnipOpen(true); }}
                  className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
                  title="Snip from screen"
                >
                  <Crop className="h-3 w-3" />
                </button>
              )}
            </div>
            <RemoveXButton
              onActivate={() => setConfirmOpen(true)}
              ariaLabel="Remove logo"
              title="Remove logo"
              iconSizeClass="h-3 w-3"
              paddingClass="p-1"
              positionClass="-top-2 -right-2"
            />

          </div>
        ) : (
          <div
            className={`relative w-[168px] h-[56px] rounded-lg border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragging ? "bg-accent border-primary/40" : "bg-muted border-border hover:bg-accent/40 hover:border-primary/30"
            }`}
            onClick={() => ref.current?.click()}
          >
            <Upload className={`h-4 w-4 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-[10px] text-muted-foreground mt-0.5">Drop or click</span>
            {supportsSnip && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSnipOpen(true); }}
                className="absolute bottom-1 right-1 bg-background/95 rounded-full p-1 shadow hover:bg-background"
                title="Snip from screen"
                aria-label="Snip from screen"
              >
                <Crop className="h-3 w-3 text-foreground" />
              </button>
            )}


          </div>

        )}
        <input
          ref={ref}
          type="file"
          accept="image/webp,image/jpeg,image/png,image/svg+xml,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
      </div>

      <MediaPreviewDialog url={previewUrl} onClose={() => setPreviewUrl(null)} />

      <RemoveConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove logo?"
        body="This will remove the logo. The change will only be saved when you click Save."
        onConfirm={() => { clear(); setConfirmOpen(false); }}
        previewUrl={preview}
        previewAlt="Logo to remove"
      />

      {supportsSnip && (
        <SnippingCapture
          open={snipOpen}
          onCancel={() => setSnipOpen(false)}
          onCapture={(file) => { setSnipOpen(false); pick(file); }}
          outputName="logo"
        />
      )}
    </div>
  );
}



/* -------------------------------------------------------------------------- */
/*  Media slots + Snip + Screenshot                                           */
/* -------------------------------------------------------------------------- */

function MediaSlots({
  value, onChange, screenshot, onSetAllSlots,
}: {
  value: [SlotState, SlotState, SlotState];
  onChange: (i: number, s: SlotState) => void;
  screenshot?: Props["screenshot"];
  onSetAllSlots: (next: [SlotState, SlotState, SlotState]) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [snipSlot, setSnipSlot] = useState<SlotNumber | null>(null);
  const [capturing, setCapturing] = useState(false);

  const supportsSnip =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const screenshotEnabled = !!screenshot; // opt-in per entity type
  const supportsScreenshot = screenshotEnabled && mediaCaptureAdapter.isScreenshotSupported();

  const filled = value.filter((s) => s.pendingFile || s.signedUrl || s.persistedPath).length;

  const handleFileForSlot = (i: number, file: File) => {
    const v = validateImageFile(file);
    if (!v.valid) { toast.error(v.error ?? "Invalid file"); return; }
    onChange(i, { ...value[i], pendingFile: file });
  };

  const handleCaptureScreenshot = async () => {
    if (!screenshot?.websiteUrl) {
      toast.error("No website URL — Enter a Company URL first.");
      return;
    }
    const availableSlots = value
      .map((s, i) => ({ s, slot: (i + 1) as SlotNumber }))
      .filter(({ s }) => !s.isLocked && !s.pendingFile && !s.signedUrl && !s.persistedPath)
      .map(({ slot }) => slot);
    if (availableSlots.length === 0) {
      toast.error("No empty slot — Clear or unlock a slot first.");
      return;
    }
    setCapturing(true);
    try {
      const res = await mediaCaptureAdapter.captureWebsiteScreenshot({
        websiteUrl: screenshot.websiteUrl,
        availableSlots,
      });
      if (!res.ok) {
        if (res.error === "not_configured") {
          toast.info("Website screenshot capture is not enabled yet. You can upload an image or use Snip from screen.");
        } else if (res.error === "invalid_url") {
          toast.error(res.message ?? "Invalid website URL for screenshot.");
        } else if (res.error === "too_large") {
          toast.error("Screenshot exceeded the 10 MB limit.");
        } else if (res.error === "timeout") {
          toast.error("Screenshot timed out. Try again.");
        } else {
          toast.error(res.message ?? "Screenshot failed");
        }
        return;
      }
      if (res.results.length === 0) {
        toast.error("No screenshots captured — Could not capture website.");
        return;
      }
      const next = [...value] as [SlotState, SlotState, SlotState];
      for (const r of res.results as CapturedMediaResult[]) {
        const idx = r.slot - 1;
        if (next[idx].isLocked) continue;
        next[idx] = { ...next[idx], pendingFile: r.file };
      }
      onSetAllSlots(next);
      const count = res.results.length;
      toast.success(`${count} screenshot${count > 1 ? "s" : ""} staged — click Save to persist.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        Media
        <span className="text-[10px] text-muted-foreground font-normal">({filled}/3)</span>
      </Label>
      <div className="flex items-center gap-2">
        {value.map((slot, i) => (
          <SlotCell
            key={i}
            slot={slot}
            index={i}
            dragging={dragSlot === i}
            setDragging={(b) => setDragSlot(b ? i : null)}
            onPick={(f) => handleFileForSlot(i, f)}
            onClear={() =>
              onChange(i, { persistedPath: null, signedUrl: null, pendingFile: null, isLocked: false })
            }
            onToggleLock={() => onChange(i, { ...slot, isLocked: !slot.isLocked })}
            onPreview={(url) => setPreviewUrl(url)}
            onSnip={() => setSnipSlot((i + 1) as SlotNumber)}
            snipSupported={supportsSnip}
            registerInput={(el) => { inputs.current[i] = el; }}
            onClickPick={() => inputs.current[i]?.click()}
          />
        ))}
      </div>

      {/* Screenshot action row — only when the parent opted in. */}
      {screenshotEnabled && (
        <div className="flex items-center gap-1.5 pt-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={
                      capturing ||
                      !supportsScreenshot ||
                      !screenshot?.websiteUrl
                    }
                    onClick={handleCaptureScreenshot}
                  >
                    {capturing
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Camera className="h-3 w-3" />}
                    <span className="ml-1">Screenshot</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {supportsScreenshot
                  ? "Capture website screenshot into the next empty slot. Saved when you click Save."
                  : "Website screenshot capture is not enabled yet. You can upload an image or use Snip from screen."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <MediaPreviewDialog url={previewUrl} onClose={() => setPreviewUrl(null)} />

      {supportsSnip && (
        <SnippingCapture
          open={snipSlot !== null}
          onCancel={() => setSnipSlot(null)}
          onCapture={(file) => {
            const slot = snipSlot;
            setSnipSlot(null);
            if (slot != null) handleFileForSlot(slot - 1, file);
          }}
          outputName={snipSlot != null ? `slot-${snipSlot}` : "capture"}
        />
      )}
    </div>
  );
}

function SlotCell({
  slot, index, dragging, setDragging,
  onPick, onClear, onToggleLock, onPreview, onSnip, snipSupported,
  registerInput, onClickPick,
}: {
  slot: SlotState;
  index: number;
  dragging: boolean;
  setDragging: (b: boolean) => void;
  onPick: (f: File) => void;
  onClear: () => void;
  onToggleLock: () => void;
  onPreview: (url: string) => void;
  onSnip: () => void;
  snipSupported: boolean;
  registerInput: (el: HTMLInputElement | null) => void;
  onClickPick: () => void;
}) {
  const preview = usePreview(slot);
  const meta = fileMetaBadge(slot);
  const badgeParts: string[] = [];
  if (meta.ext) badgeParts.push(meta.ext);
  if (meta.size != null) badgeParts.push(formatFileSize(meta.size));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasImage = !!(slot.pendingFile || slot.persistedPath || slot.signedUrl);

  return (
    <div className="relative">
      {preview ? (
        <div
          className="group relative cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        >
          <ImageWithSkeleton
            src={preview}
            alt={`Media ${index + 1}`}
            width={96}
            height={64}
            className="object-cover"
          />
          <div className="absolute inset-0 rounded-md bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
              className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
              title="Preview"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClickPick(); }}
              className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
              title="Replace"
            >
              <Upload className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
              className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
              title={slot.isLocked ? "Unlock" : "Lock"}
            >
              {slot.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>
          </div>
          {slot.isLocked && (
            <div className="absolute top-0.5 left-0.5 bg-background/80 rounded-full p-0.5">
              <Lock className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          )}
          {badgeParts.length > 0 && (
            <div className="absolute bottom-0.5 left-0.5 bg-background/80 rounded px-1 py-0.5">
              <span className="text-[8px] text-muted-foreground">{badgeParts.join(" — ")}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-md border border-dashed cursor-pointer transition-colors",
            dragging
              ? "bg-accent border-primary/40"
              : "bg-muted border-border hover:bg-accent/40 hover:border-primary/30",
          )}
          style={{ width: 96, height: 64 }}
          onClick={onClickPick}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f && f.type.startsWith("image/")) onPick(f);
          }}
        >
          <Upload className={`h-3.5 w-3.5 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-[8px] text-muted-foreground mt-0.5">Slot {index + 1}</span>
          {snipSupported && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSnip(); }}
              title="Snip from screen"
              className="absolute bottom-0.5 right-0.5 bg-background/90 hover:bg-background text-foreground rounded-full p-0.5 shadow"
            >
              <Crop className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      )}
      <SlotPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        url={preview}
        alt={`Slot ${index + 1} image`}
        onRequestDelete={() => { setPreviewOpen(false); setConfirmOpen(true); }}
      />

      <RemoveConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Warning"
        body="Do you wish to remove this image?"
        onConfirm={() => { onClear(); setConfirmOpen(false); }}
        previewUrl={preview}
        previewAlt={`Slot ${index + 1} image to remove`}
      />
      <input
        ref={registerInput}
        type="file"
        accept="image/webp,image/jpeg,image/png,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/*  Upload orchestration (unchanged public contract)                          */
/* -------------------------------------------------------------------------- */

export interface UploadFn {
  (args: { kind: "logo" | "slot-1" | "slot-2" | "slot-3"; ext: string }): Promise<{ path: string; token: string }>;
}

export async function uploadPending(
  state: EntityMediaState,
  uploadFn: UploadFn,
  storage: {
    uploadToSignedUrl: (
      path: string,
      token: string,
      file: File,
      opts?: { contentType?: string; upsert?: boolean },
    ) => Promise<{ error: Error | null }>;
  },
): Promise<{ logoPath: string | null; media: { slot: 1 | 2 | 3; image_path: string }[] }> {
  async function upload(file: File, kind: "logo" | "slot-1" | "slot-2" | "slot-3"): Promise<string> {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const { path, token } = await uploadFn({ kind, ext });
    const { error } = await storage.uploadToSignedUrl(path, token, file, {
      contentType: file.type || "image/png",
      upsert: true,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path;
  }

  const logoPath = state.logo.pendingFile
    ? await upload(state.logo.pendingFile, "logo")
    : state.logo.persistedPath;

  const media: { slot: 1 | 2 | 3; image_path: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const s = state.slots[i];
    const slotNum = (i + 1) as 1 | 2 | 3;
    if (s.pendingFile) {
      const path = await upload(s.pendingFile, `slot-${slotNum}` as const);
      media.push({ slot: slotNum, image_path: path });
    } else if (s.persistedPath) {
      media.push({ slot: slotNum, image_path: s.persistedPath });
    }
  }

  return { logoPath, media };
}
