import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { usePermissions } from "@/hooks/use-session-context";

export function GlobalStartupLineageBadge({
  sourceGlobalId,
  importedAt,
}: {
  sourceGlobalId: string | null | undefined;
  importedAt: string | null | undefined;
}) {
  const { has } = usePermissions();
  if (!sourceGlobalId) return null;

  const dateLabel = importedAt ? new Date(importedAt).toLocaleDateString() : "—";
  const text = `Imported from Global Catalogue on ${dateLabel}`;
  const canLink = has("global_startups.read");

  const body = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
      <Globe className="h-3 w-3" />
      {text}
    </span>
  );

  if (!canLink) return body;
  return (
    <Link
      to="/global-startups/$id"
      params={{ id: sourceGlobalId }}
      className="inline-block hover:opacity-90"
    >
      {body}
    </Link>
  );
}
