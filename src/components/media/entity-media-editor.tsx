import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Visual logo + 3-slot media editor used by both Startup and Investor forms.
 *
 * Persistence is owned by the parent: this component only tracks the
 * intended state per slot ({ persistedPath, signedUrl, pendingFile }).
 * Parent uploads `pendingFile`s on submit, resolves them to storage paths,
 * and writes the final paths via the entity's update server fn. This keeps
 * cancel semantics clean (no orphaned uploads if the user navigates away
 * without saving).
 */
export interface SlotState {
  /** path in the storage bucket (e.g. "<tenantId>/<entityId>/<filename>"). */
  persistedPath: string | null;
  /** signed URL for `persistedPath`, if known. */
  signedUrl: string | null;
  /** file the user picked but hasn't saved yet — wins over signedUrl in preview. */
  pendingFile: File | null;
}

export const EMPTY_SLOT: SlotState = { persistedPath: null, signedUrl: null, pendingFile: null };

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
}

export function EntityMediaEditor({ value, onChange }: Props) {
  const setLogo = (logo: SlotState) => onChange({ ...value, logo });
  const setSlot = (i: number, slot: SlotState) => {
    const next = [...value.slots] as [SlotState, SlotState, SlotState];
    next[i] = slot;
    onChange({ ...value, slots: next });
  };
  return (
    <div className="flex items-start gap-10 flex-wrap">
      <LogoSlot value={value.logo} onChange={setLogo} />
      <MediaSlots value={value.slots} onChange={setSlot} />
    </div>
  );
}

function usePreview(slot: SlotState): string | null {
  const blob = useMemo(
    () => (slot.pendingFile ? URL.createObjectURL(slot.pendingFile) : null),
    [slot.pendingFile],
  );
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  return blob ?? slot.signedUrl;
}

function LogoSlot({ value, onChange }: { value: SlotState; onChange: (s: SlotState) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = usePreview(value);

  const pick = (f: File) => onChange({ ...value, pendingFile: f });
  const clear = () => onChange({ persistedPath: null, signedUrl: null, pendingFile: null });

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
          <div className="relative group cursor-pointer" onClick={() => ref.current?.click()}>
            <img
              src={preview}
              alt="Logo"
              className="w-[168px] h-[56px] rounded-lg object-contain border border-border group-hover:opacity-60 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove logo"
            >
              <X className="h-3 w-3" />
            </button>
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
          </div>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function MediaSlots({
  value, onChange,
}: { value: [SlotState, SlotState, SlotState]; onChange: (i: number, s: SlotState) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const filled = value.filter((s) => s.pendingFile || s.signedUrl || s.persistedPath).length;

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
            onPick={(f) => onChange(i, { ...slot, pendingFile: f })}
            onClear={() => onChange(i, { persistedPath: null, signedUrl: null, pendingFile: null })}
            registerInput={(el) => { inputs.current[i] = el; }}
            onClickPick={() => inputs.current[i]?.click()}
          />
        ))}
      </div>
    </div>
  );
}

function SlotCell({
  slot, index, dragging, setDragging, onPick, onClear, registerInput, onClickPick,
}: {
  slot: SlotState;
  index: number;
  dragging: boolean;
  setDragging: (b: boolean) => void;
  onPick: (f: File) => void;
  onClear: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
  onClickPick: () => void;
}) {
  const preview = usePreview(slot);
  return (
    <div className="relative">
      {preview ? (
        <div className="group relative">
          <img
            src={preview}
            alt={`Product ${index + 1}`}
            className="w-[96px] h-[64px] rounded-md object-cover border border-border"
          />
          <div className="absolute inset-0 rounded-md bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={onClickPick}
              className="p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
              title="Replace"
            >
              <Upload className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-full bg-background/80 hover:bg-background text-destructive"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center rounded-md border border-dashed cursor-pointer transition-colors ${
            dragging ? "bg-accent border-primary/40" : "bg-muted border-border hover:bg-accent/40 hover:border-primary/30"
          }`}
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
          <Upload className={`h-4 w-4 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground mt-0.5">Slot {index + 1}</span>
        </div>
      )}
      <input
        ref={registerInput}
        type="file"
        accept="image/*"
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

/**
 * Upload all pending files in `state` and return the resolved persisted state.
 *
 * - For each slot with a `pendingFile`: request a signed upload URL via the
 *   passed server fn, PUT to the bucket, and replace pendingFile with the new
 *   persistedPath. The OLD persistedPath (if any) is preserved on the returned
 *   `replacedPaths` list so the parent's update server fn can delete the
 *   orphan from storage.
 * - Slots with no pendingFile keep their persistedPath unchanged.
 *
 * Throws on the first upload error; the parent should toast and abort the
 * save without writing to the DB so client state stays consistent.
 */
export interface UploadFn {
  (args: { kind: "logo" | "slot-1" | "slot-2" | "slot-3"; ext: string }): Promise<{ path: string; token: string }>;
}

export async function uploadPending(
  state: EntityMediaState,
  uploadFn: UploadFn,
  storage: { uploadToSignedUrl: (path: string, token: string, file: File, opts?: { contentType?: string; upsert?: boolean }) => Promise<{ error: Error | null }> },
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
