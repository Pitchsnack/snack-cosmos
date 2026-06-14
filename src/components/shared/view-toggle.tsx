import { Grid3X3, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "split";

export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5",
        className,
      )}
    >
      <Btn active={value === "grid"} onClick={() => onChange("grid")} label="Grid view">
        <Grid3X3 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </Btn>
      <Btn active={value === "split"} onClick={() => onChange("split")} label="Split view">
        <Columns2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Split</span>
      </Btn>
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
