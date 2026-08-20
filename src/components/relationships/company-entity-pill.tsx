import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export interface CompanyEntityPillProps {
  name: string;
  logoUrl?: string | null;
  /** Route target; when omitted the pill renders as a static span. */
  to?: "/startups/$id" | "/investors/$id";
  id?: string;
  className?: string;
}

const PILL_CLASS =
  "flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground/85 transition hover:border-accent/40 hover:text-foreground";

/**
 * Shared company pill (logo + name) used by Portfolio Startups and Investors so
 * both sections stay visually identical.
 */
export function CompanyEntityPill({ name, logoUrl, to, id, className }: CompanyEntityPillProps) {
  const body = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-[9px] font-semibold text-muted-foreground">
        {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
      </span>
      {name}
    </>
  );

  if (to && id) {
    return (
      <Link to={to} params={{ id }} className={cn(PILL_CLASS, className)}>
        {body}
      </Link>
    );
  }
  return <span className={cn(PILL_CLASS, className)}>{body}</span>;
}
