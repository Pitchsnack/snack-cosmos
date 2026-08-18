import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditableUrlFieldProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  /** Marks the field as compulsory (asterisk + native required). */
  required?: boolean;
  /** Fired with the normalized URL once the value is committed (blur/Enter). */
  onCommit?: (url: string) => void;
}

/**
 * URL input that switches to a clickable hyperlink (opens in a new tab) once a
 * value is committed. A pencil button returns the field to edit mode.
 * Mirrors the Company URL UX from the PitchSnack1 admin startup directory.
 */
export function EditableUrlField({
  value,
  onChange,
  label,
  placeholder = "https://example.com",
  maxLength = 2048,
  required = false,
  onCommit,
}: EditableUrlFieldProps) {
  const [editing, setEditing] = useState(!value?.trim());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  // Sync edit state when the value is filled externally (e.g. server hydration).
  const prevValueRef = useRef(value);
  useEffect(() => {
    const prev = prevValueRef.current?.trim();
    const next = value?.trim();
    if (!prev && next && document.activeElement !== inputRef.current) {
      setEditing(false);
    }
    if (!next) setEditing(true);
    prevValueRef.current = value;
  }, [value]);

  const normalizeUrl = (raw: string): string => {
    const t = raw.trim();
    if (!t) return "";
    const protoMatch = t.match(/^(https?:\/\/)(.*)$/i);
    const proto = protoMatch ? protoMatch[1].toLowerCase() : "https://";
    const rest = protoMatch ? protoMatch[2] : t;
    const slashIdx = rest.indexOf("/");
    let host = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    const tail = slashIdx === -1 ? "" : rest.slice(slashIdx);
    if (host && !/^www\./i.test(host)) {
      const hostNoPort = host.split(":")[0];
      const labels = hostNoPort.split(".").filter(Boolean);
      if (labels.length === 2) host = `www.${host}`;
    }
    return `${proto}${host}${tail}`;
  };

  const commit = () => {
    const t = value?.trim();
    if (!t) return;
    const normalized = normalizeUrl(t);
    if (normalized !== value) onChange(normalized);
    setEditing(false);
    onCommit?.(normalized);
  };

  const trimmed = value?.trim() ?? "";
  const href = trimmed
    ? trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`
    : "#";

  const openInSeparateWindow = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    const features =
      "noopener,noreferrer,resizable=yes,scrollbars=yes,width=1200,height=800";
    const win = window.open(href, "_blank", features);
    win?.focus();
  };

  if (!editing && trimmed) {
    return (
      <div className="space-y-1.5">
        <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
        <div className="flex min-h-9 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5">
          <a
            href={href}
            onClick={openInSeparateWindow}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-sm text-primary underline hover:text-primary/80"
          >
            {trimmed}
          </a>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={`Edit ${label}`}
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input
        ref={inputRef}
        type="url"
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}

export default EditableUrlField;
