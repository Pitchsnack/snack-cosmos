import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FounderDraft {
  full_name: string;
  position?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
}

interface Props {
  value: FounderDraft[];
  onChange: (next: FounderDraft[]) => void;
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

export function FounderEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<FounderDraft>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border bg-background p-3">
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
