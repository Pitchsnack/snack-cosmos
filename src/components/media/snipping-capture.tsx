import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, RotateCcw, X, Camera } from "lucide-react";

/**
 * Snip From Screen — browser-based screen crop capture.
 *
 * Ported from PitchSnack1 SnippingCapture. Backend-neutral: produces a WebP
 * File and hands it back to the caller, which stages it as a pending media
 * file in EntityMediaEditor. No storage writes, no backend calls, no
 * tracker rows.
 *
 * Gated by `navigator.mediaDevices.getDisplayMedia` — hide the trigger UI
 * when unsupported.
 */

interface SnippingCaptureProps {
  open: boolean;
  onCancel: () => void;
  onCapture: (file: File) => void;
  outputName: string;
}

type Mode = "INIT" | "SNIPPING" | "PREVIEW";
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

const MIN_SIZE = 20;

const getSelectionBox = (start: Point | null, current: Point | null): Box | null => {
  if (!start || !current) return null;
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
};

export function SnippingCapture({ open, onCancel, onCapture, outputName }: SnippingCaptureProps) {
  const [mode, setMode] = useState<Mode>("INIT");
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const previewBlobRef = useRef<Blob | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const clearPreview = useCallback(() => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    previewBlobRef.current = null;
  }, []);

  const releaseFrame = useCallback(() => {
    sourceCanvasRef.current = null;
    setFrameReady(false);
  }, []);

  const reset = useCallback(() => {
    setMode("INIT");
    setStart(null);
    setCurrent(null);
    clearPreview();
    releaseFrame();
  }, [clearPreview, releaseFrame]);

  const handleCancel = useCallback(() => {
    reset();
    onCancel();
  }, [onCancel, reset]);

  // Capture exactly one frame, then stop the stream BEFORE rendering snip UI.
  const captureFrame = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Screen capture isn't available in this browser.");
      onCancel();
      return;
    }

    setMode("INIT");
    setStart(null);
    setCurrent(null);
    clearPreview();
    releaseFrame();

    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
        audio: false,
      } as DisplayMediaStreamOptions);

      try { window.focus(); } catch { /* noop */ }

      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("Video load failed")); };
        const cleanup = () => {
          video!.removeEventListener("loadedmetadata", onLoaded);
          video!.removeEventListener("error", onError);
        };
        video!.addEventListener("loadedmetadata", onLoaded);
        video!.addEventListener("error", onError);
      });

      await video.play();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w <= 0 || h <= 0) throw new Error("Captured frame has zero dimensions.");

      const source = document.createElement("canvas");
      source.width = w;
      source.height = h;
      const sctx = source.getContext("2d");
      if (!sctx) throw new Error("Canvas 2D unavailable.");
      sctx.drawImage(video, 0, 0, w, h);
      sourceCanvasRef.current = source;

      stream.getTracks().forEach((t) => t.stop());
      stream = null;

      video.pause();
      video.srcObject = null;
      video = null;

      setMode("SNIPPING");
    } catch (err: unknown) {
      stream?.getTracks().forEach((t) => t.stop());
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      const e = err as { name?: string; message?: string };
      if (e?.name !== "NotAllowedError") {
        toast.error(e?.message ?? "Could not capture screen.");
      }
      onCancel();
    }
  }, [clearPreview, onCancel, releaseFrame]);

  useEffect(() => {
    if (open) void captureFrame();
    else reset();
  }, [open, reset, captureFrame]);

  useEffect(() => {
    return () => {
      clearPreview();
      releaseFrame();
    };
  }, [clearPreview, releaseFrame]);

  useEffect(() => {
    if (mode !== "SNIPPING") return;
    const display = displayCanvasRef.current;
    const source = sourceCanvasRef.current;
    if (!display || !source) return;
    display.width = source.width;
    display.height = source.height;
    const ctx = display.getContext("2d");
    if (!ctx) {
      toast.error("Canvas 2D is unavailable.");
      handleCancel();
      return;
    }
    ctx.drawImage(source, 0, 0);
    setFrameReady(true);
  }, [mode, handleCancel]);

  const selectionBox = getSelectionBox(start, current);

  const cropToPreview = useCallback(
    (box: Box) => {
      const display = displayCanvasRef.current;
      const source = sourceCanvasRef.current;
      if (!display || !source || !frameReady) {
        toast.error("Frame is not ready.");
        setStart(null); setCurrent(null);
        return;
      }
      const rect = display.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        toast.error("Display surface has zero size.");
        return;
      }
      const sx = source.width / rect.width;
      const sy = source.height / rect.height;
      const left = Math.max(rect.left, Math.min(rect.right, box.x));
      const top = Math.max(rect.top, Math.min(rect.bottom, box.y));
      const right = Math.max(rect.left, Math.min(rect.right, box.x + box.w));
      const bottom = Math.max(rect.top, Math.min(rect.bottom, box.y + box.h));
      const cropX = Math.round((left - rect.left) * sx);
      const cropY = Math.round((top - rect.top) * sy);
      const cropW = Math.round((right - left) * sx);
      const cropH = Math.round((bottom - top) * sy);
      if (cropW <= 0 || cropH <= 0) { setStart(null); setCurrent(null); return; }

      const out = document.createElement("canvas");
      out.width = cropW; out.height = cropH;
      const octx = out.getContext("2d");
      if (!octx) { toast.error("Canvas 2D is unavailable."); return; }
      octx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      out.toBlob(
        (blob) => {
          if (!blob) { toast.error("Could not encode WebP."); return; }
          previewBlobRef.current = blob;
          setPreviewUrl((existing) => {
            if (existing) URL.revokeObjectURL(existing);
            return URL.createObjectURL(blob);
          });
          setMode("PREVIEW");
          setStart(null); setCurrent(null);
        },
        "image/webp",
        0.9,
      );
    },
    [frameReady],
  );

  const confirmCapture = useCallback(() => {
    const blob = previewBlobRef.current;
    if (!blob) return;
    const file = new File([blob], `${outputName}.webp`, { type: "image/webp" });
    reset();
    onCapture(file);
  }, [outputName, onCapture, reset]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleCancel(); }
      else if (e.key === "Enter" && mode === "PREVIEW") { e.preventDefault(); confirmCapture(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, mode, handleCancel, confirmCapture]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode !== "SNIPPING" || !frameReady) return;
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (mode !== "SNIPPING" || !frameReady || !start) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  };
  const onMouseUp = () => {
    if (mode !== "SNIPPING" || !selectionBox) return;
    if (selectionBox.w < MIN_SIZE || selectionBox.h < MIN_SIZE) {
      setStart(null); setCurrent(null); return;
    }
    cropToPreview(selectionBox);
  };

  const retry = () => {
    clearPreview();
    setStart(null); setCurrent(null);
    if (sourceCanvasRef.current) { setMode("SNIPPING"); return; }
    void captureFrame();
  };
  const recapture = () => {
    clearPreview();
    setStart(null); setCurrent(null);
    releaseFrame();
    void captureFrame();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] select-none" style={{ pointerEvents: "all" }}>
      {mode === "INIT" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-background px-4 py-3 text-sm text-foreground shadow-lg">
            Waiting for screen capture permission… Pick <b>a tab</b>, <b>a window</b>, or <b>your entire screen</b>.
            <button onClick={handleCancel} className="ml-3 text-xs text-muted-foreground underline">Cancel</button>
          </div>
        </div>
      )}

      {mode === "SNIPPING" && (
        <div className="absolute inset-0 grid place-items-center overflow-hidden bg-black">
          <canvas
            ref={displayCanvasRef}
            className="pointer-events-none block"
            style={{ maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "auto", objectFit: "contain" }}
          />
          <div
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            {selectionBox ? (
              <>
                <div className="absolute bg-black/60 pointer-events-none" style={{ left: 0, top: 0, width: "100%", height: selectionBox.y }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ left: 0, top: selectionBox.y + selectionBox.h, width: "100%", bottom: 0 }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ left: 0, top: selectionBox.y, width: selectionBox.x, height: selectionBox.h }} />
                <div className="absolute bg-black/60 pointer-events-none" style={{ left: selectionBox.x + selectionBox.w, top: selectionBox.y, right: 0, height: selectionBox.h }} />
                <div
                  className="absolute border border-dashed border-white pointer-events-none"
                  style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.w, height: selectionBox.h, background: "rgba(255,255,255,0.10)" }}
                />
                <div
                  className="absolute rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white pointer-events-none"
                  style={{ left: selectionBox.x, top: selectionBox.y + selectionBox.h + 4 }}
                >
                  {Math.round(selectionBox.w)} × {Math.round(selectionBox.h)}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            )}
            {!frameReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
                <div className="rounded-full bg-background/95 px-3 py-1.5 text-xs text-foreground shadow">
                  Preparing capture surface…
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-background/95 px-3 py-1.5 text-xs text-foreground shadow pointer-events-none">
            Drag to select an area · <kbd className="rounded bg-muted px-1">ESC</kbd> to cancel
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); recapture(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-background/95 px-3 py-1.5 text-xs text-foreground shadow hover:bg-background"
              title="Recapture"
            >
              <Camera className="h-3.5 w-3.5" /> Recapture
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded-full bg-background/95 p-1.5 text-foreground shadow hover:bg-background"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {mode === "PREVIEW" && previewUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6">
          <div className="text-sm text-white">Preview · confirm or retry</div>
          <img
            src={previewUrl}
            alt="Capture preview"
            className="max-h-[70vh] max-w-[80vw] rounded-md border border-white/20 bg-black object-contain"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={retry}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry</Button>
            <Button variant="outline" size="sm" onClick={recapture}><Camera className="mr-1 h-3.5 w-3.5" /> Recapture</Button>
            <Button variant="outline" size="sm" onClick={handleCancel}><X className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
            <Button size="sm" onClick={confirmCapture}><Check className="mr-1 h-3.5 w-3.5" /> Use Capture</Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
