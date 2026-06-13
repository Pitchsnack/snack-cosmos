import { useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { createStartupMediaUploadUrl, getStartupSignedUrl } from "@/lib/startups.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  startupId?: string;
  kind: "logo" | "slot-1" | "slot-2" | "slot-3";
  /** stored path within the startup-media bucket */
  path: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  className?: string;
  aspect?: "square" | "video";
}

export function MediaUploader({ tenantId, startupId, kind, path, onChange, label, className, aspect = "video" }: Props) {
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
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    setUploading(true);
    try {
      const { path: newPath, token } = await getUploadUrl({ data: { tenantId, startupId, kind, ext } });
      const { error } = await supabase.storage.from("startup-media").uploadToSignedUrl(newPath, token, file, {
        contentType: file.type || "image/png",
        upsert: true,
      });
      if (error) throw error;
      onChange(newPath);
      setPreview(URL.createObjectURL(file));
    } catch (e: unknown) {
      toast.error("Upload failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setUploading(false);
    }
  }

  const dims = aspect === "square" ? "aspect-square" : "aspect-video";

  return (
    <div className={cn("space-y-2", className)}>
      {label && <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>}
      <div className={cn("relative w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/30", dims)}>
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="mb-1 h-6 w-6 opacity-50" />
            <span className="text-[11px]">No image</span>
          </div>
        )}
        {path && !uploading && (
          <button
            type="button"
            onClick={() => { onChange(null); setPreview(null); }}
            className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
            aria-label="Remove"
          >
            <X className="h-3.5 w-3.5" />
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
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-3.5 w-3.5" />
        {uploading ? "Uploading…" : path ? "Replace" : "Upload image"}
      </Button>
    </div>
  );
}
