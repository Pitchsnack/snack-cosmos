import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function EntityLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" /> : monogram(name)}
    </span>
  );
}

/** Compact clickable row used inside grouped portfolio sections. */
export function EntityRow({
  to,
  id,
  name,
  logoUrl,
  description,
  tags,
  country,
  websiteUrl,
}: {
  to: "/startups/$id" | "/investors/$id";
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  tags?: (string | null | undefined)[];
  country?: string | null;
  websiteUrl?: string | null;
}) {
  const chips = (tags ?? []).filter((t): t is string => !!t);
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border/60 bg-background p-3 transition hover:border-accent/40 hover:shadow-card">
      <EntityLogo name={name} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <Link
          to={to}
          params={{ id }}
          className="text-sm font-medium leading-tight text-foreground hover:text-accent hover:underline"
        >
          {name}
        </Link>
        {description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {chips.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-medium text-foreground/80">
              {t}
            </span>
          ))}
          {country && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" strokeWidth={1.75} />
              {country}
            </span>
          )}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} /> Website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
        {open ? "Collapse" : `View all ${count}`}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </span>
    </button>
  );
}

export function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function RankedBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${max > 0 ? Math.max(6, (value / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}
