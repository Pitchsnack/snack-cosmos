import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript|file):/i;

/**
 * Build an href for a saved Company URL value.
 * - Trims whitespace
 * - Returns "" for empty or unsafe schemes (javascript:, data:, etc.)
 * - Prefixes `https://` only when the value has no http(s) scheme
 * - Never mutates the saved value itself (this is for display only)
 */
export function buildCompanyUrlHref(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (UNSAFE_SCHEME.test(trimmed)) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

interface CompanyUrlLinkProps {
  value: string | null | undefined;
  /** Override the visible text (defaults to the raw value). */
  display?: string;
  /** Strip scheme from the visible label. */
  stripScheme?: boolean;
  /** Optional max chars before slicing the label (no ellipsis added). */
  maxChars?: number;
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

export function CompanyUrlLink({
  value,
  display,
  stripScheme = false,
  maxChars,
  className,
  showIcon = true,
  iconClassName = "h-3 w-3",
}: CompanyUrlLinkProps) {
  const href = buildCompanyUrlHref(value);
  if (!href || !value) return null;

  let label = display ?? value;
  if (stripScheme) label = label.replace(/^https?:\/\//i, "");
  if (maxChars && label.length > maxChars) label = label.slice(0, maxChars);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      className={cn(
        "inline-flex items-center gap-0.5 hover:text-foreground hover:underline underline-offset-2",
        className,
      )}
    >
      {showIcon && <ExternalLink className={iconClassName} />}
      <span className="truncate">{label}</span>
    </a>
  );
}
