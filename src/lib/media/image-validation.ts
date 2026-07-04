/**
 * Client-side image validation shared by all media UI components.
 * MIME + extension + 10MB size cap. Backend-agnostic — no Supabase imports.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
  "image/webp",
]);

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp"]);

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ValidationResult {
  if (!ALLOWED_MIME.has(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type || "unknown"}. Use JPG, PNG, GIF, SVG, or WebP.` };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return { valid: false, error: `Unsupported file extension: .${ext}` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File too large (${sizeMB} MB). Maximum is 10 MB.` };
  }
  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
