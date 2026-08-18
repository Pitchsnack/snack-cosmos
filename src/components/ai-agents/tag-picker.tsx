import { X, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function TagPicker({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm hover:border-primary/40"
          >
            {value.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >
                {v}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((x) => x !== v));
                  }}
                />
              </span>
            ))}
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {value.length ? "" : placeholder}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div className="max-h-64 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  value.includes(o) && "text-primary",
                )}
              >
                {o}
                {value.includes(o) && <span className="text-xs">✓</span>}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
