import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Trash2, Upload, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { createStartupMediaUploadUrl, getStartupSignedUrl } from "@/lib/startups.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FounderDraft {
  full_name: string;
  position?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  photo_url?: string | null;
}

interface Props {
  value: FounderDraft[];
  onChange: (next: FounderDraft[]) => void;
  tenantId?: string;
  startupId?: string;
}

const POSITION_OPTIONS = [
  "Founder",
  "Co-founder",
  "CEO",
  "CTO",
  "CFO",
  "C-suite",
  "Other",
] as const;

function parsePositions(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert an image File to a WebP Blob via an offscreen canvas. Max edge 1024px. */
async function fileToWebp(file: File, quality = 0.9, maxEdge = 1024): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("WebP encode failed"))),
        "image/webp",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function FounderPhoto({
  path,
  onChange,
  tenantId,
  startupId,
}: {
  path: string | null | undefined;
  onChange: (path: string | null) => void;
  tenantId?: string;
  startupId?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUploadUrl = useServerFn(createStartupMediaUploadUrl);
  const getReadUrl = useServerFn(getStartupSignedUrl);

  useEffect(() => {
    let cancel = false;
    if (!path) { setPreview(null); return; }
    getReadUrl({ data: { path } }).then((r) => { if (!cancel) setPreview(r.url); }).catch(() => {});
    return () => { cancel = true; };
  }, [path, getReadUrl]);

  async function onFile(file: File) {
    if (!tenantId) { toast.error("Select a tenant first"); return; }
    setUploading(true);
    try {
      const webp = await fileToWebp(file);
      const { path: newPath, token } = await getUploadUrl({
        data: { tenantId, startupId, kind: "founder", ext: "webp" },
      });
      const { error } = await supabase.storage
        .from("startup-media")
        .uploadToSignedUrl(newPath, token, webp, { contentType: "image/webp", upsert: true });
      if (error) throw error;
      onChange(newPath);
      setPreview(URL.createObjectURL(webp));
    } catch (e: unknown) {
      toast.error("Upload failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-dashed border-border bg-muted/30">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <User className="h-7 w-7 opacity-50" />
          </div>
        )}
        {path && !uploading && (
          <button
            type="button"
            onClick={() => { onChange(null); setPreview(null); }}
            className="absolute right-0 top-0 rounded-full bg-background/85 p-0.5 text-foreground hover:bg-background"
            aria-label="Remove photo"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-3 w-3" />
        {uploading ? "…" : path ? "Replace" : "Photo"}
      </Button>
    </div>
  );
}

function PositionMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
            {value.length === 0 ? (
              <span className="text-muted-foreground">Position</span>
            ) : (
              value.map((v) => (
                <Badge key={v} variant="secondary" className="h-5 gap-1 px-1.5 text-xs font-normal">
                  {v}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                    className="rounded-sm hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {POSITION_OPTIONS.map((opt) => {
          const checked = value.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function FounderEditor({ value, onChange, tenantId, startupId }: Props) {
  const update = (i: number, patch: Partial<FounderDraft>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex gap-3">
            <FounderPhoto
              path={f.photo_url}
              onChange={(p) => update(i, { photo_url: p })}
              tenantId={tenantId}
              startupId={startupId}
            />
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Input
                  placeholder="Full name *"
                  value={f.full_name}
                  onChange={(e) => update(i, { full_name: e.target.value })}
                />
                <PositionMultiSelect
                  value={parsePositions(f.position)}
                  onChange={(next) => update(i, { position: next.join(", ") || null })}
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={f.linkedin_url ?? ""}
                  onChange={(e) => update(i, { linkedin_url: e.target.value })}
                />
              </div>
              <Textarea
                placeholder="Short bio"
                rows={2}
                value={f.bio ?? ""}
                onChange={(e) => update(i, { bio: e.target.value })}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { full_name: "" }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Add founder
      </Button>
    </div>
  );
}
