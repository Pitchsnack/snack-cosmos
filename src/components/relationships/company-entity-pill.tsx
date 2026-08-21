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
  /** When provided the chip opens an in-place panel instead of navigating. */
  onSelect?: (id: string) => void;
}

/**
 * Shared company chip (logo + name). Uses the exact same geometry as the
 * portfolio page chips so both surfaces stay identical.
 */
export function CompanyEntityPill({
  name,
  logoUrl,
  to,
  id,
  className,
  onSelect,
}: CompanyEntityPillProps) {
  const body = <ChipBody name={name} logoUrl={logoUrl} />;

  if (onSelect && id) {
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        className={cn(CHIP_CLASS, "text-left", className)}
      >
        {body}
      </button>
    );
  }

  if (to && id) {
    return (
      <Link to={to} params={{ id }} className={cn(CHIP_CLASS, className)}>
        {body}
      </Link>
    );
  }
  return <span className={cn(CHIP_CLASS, className)}>{body}</span>;
}
