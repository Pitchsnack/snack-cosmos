import { Globe, Lock, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicationStatus } from "@/lib/publication";

const MAP: Record<
  PublicationStatus,
  { label: string; className: string; Icon: typeof Lock }
> = {
  private: {
    label: "Private",
    className: "border-border bg-muted text-muted-foreground",
    Icon: Lock,
  },
  published: {
    label: "Published",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Icon: Globe,
  },
  unpublished: {
    label: "Unpublished",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Icon: EyeOff,
  },
};

export function PublicationBadge({
  status,
  className,
}: {
  status: PublicationStatus;
  className?: string;
}) {
  const { label, className: tone, Icon } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone,
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/** Badge bound to the publication adapter for a single startup. */
export function StartupPublicationBadge({
  status,
  className,
}: {
  status: PublicationStatus;
  className?: string;
}) {
  return <PublicationBadge status={status} className={className} />;
}
