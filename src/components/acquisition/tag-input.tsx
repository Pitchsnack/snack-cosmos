import { useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Compact chip editor: type + Enter/comma adds a tag, X removes it.
 * Optional suggestions render as one-click chips below the input.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  max,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  disabled?: boolean;
  /** Maximum number of tags; input and suggestions hide once reached. */
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const atMax = max != null && value.length >= max;

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "");
    if (!tag) return;
    if (!atMax && !value.some((v) => v.toLowerCase() === tag.toLowerCase()))
      onChange([...value, tag]);
    setDraft("");
  };

  const remaining = (suggestions ?? []).filter(
    (sg) => !value.some((v) => v.toLowerCase() === sg.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5",
          disabled && "opacity-60",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-foreground/85"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((v) => v !== tag))}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && !atMax && (
          <Input
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(",")) add(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => add(draft)}
            placeholder={value.length === 0 ? placeholder : "Add…"}
            className="h-6 min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0 text-xs shadow-none focus-visible:ring-0"
          />
        )}
      </div>
      {remaining.length > 0 && !disabled && !atMax && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Suggested
          </span>
          {remaining.slice(0, 8).map((sg) => (
            <button
              key={sg}
              type="button"
              onClick={() => add(sg)}
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + {sg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
