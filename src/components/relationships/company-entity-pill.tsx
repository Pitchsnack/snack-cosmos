import { Link } from "@tanstack/react-router";
import { CHIP_CLASS, ChipBody } from "@/components/relationships/portfolio-chips";
import { cn } from "@/lib/utils";

export interface CompanyEntityPillProps {
  name: string;
  logoUrl?: string | null;
  /** Route target; when omitted the pill renders as a static span. */
  to?: "/startups/$id" | "/investors/$id";
  id?: string;
  className?: string;
}

/**
 * Shared company chip (logo + name). Uses the exact same geometry as the
 * portfolio page chips so both surfaces stay identical.
 */
export function CompanyEntityPill({ name, logoUrl, to, id, className }: CompanyEntityPillProps) {
  const body = <ChipBody name={name} logoUrl={logoUrl} />;

  if (to && id) {
    return (
      <Link to={to} params={{ id }} className={cn(CHIP_CLASS, className)}>
        {body}
      </Link>
    );
  }
  return <span className={cn(CHIP_CLASS, className)}>{body}</span>;
}
