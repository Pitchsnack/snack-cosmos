import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reads the restriction keys attached by maskRestricted(). */
export function restrictedSet(item: unknown): Set<string> {
  const keys = (item as { restricted_fields?: string[] } | null)?.restricted_fields ?? [];
  return new Set(keys);
}

/** Greyed-out placeholder shown in place of a restricted value. */
export function RestrictedPill({
  label = "Restricted",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      title="Restricted from non-authorized users"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70",
        className,
      )}
    >
      <Lock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/** Greyed-out block placeholder (logos, images). */
export function RestrictedBlock({ className }: { className?: string }) {
  return (
    <div
      title="Restricted from non-authorized users"
      className={cn(
        "flex h-full w-full items-center justify-center bg-muted text-muted-foreground/60",
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5" />
    </div>
  );
}
