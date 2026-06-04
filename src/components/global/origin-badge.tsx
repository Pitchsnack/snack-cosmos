import { Badge } from "@/components/ui/badge";
import { Globe2, Building2 } from "lucide-react";

/**
 * Origin badge per PRD 8.
 *  - "Global" — a Control-pool record (used on global directory pages,
 *    or in tenant pages on rows where `sourceGlobalId === null` to mark
 *    the record as a native global candidate).
 *  - "Tenant" — a tenant-owned record. When `sourceGlobalId` is set,
 *    that record was created via Import-from-Global (lineage).
 */
export function OriginBadge({
  origin,
  imported = false,
}: {
  origin: "global" | "tenant";
  imported?: boolean;
}) {
  if (origin === "global") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-primary/40 bg-primary/10 text-primary"
      >
        <Globe2 className="h-3 w-3" /> Global
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-accent/40 bg-accent/10 text-accent"
      title={imported ? "Imported from Global record" : "Tenant-native record"}
    >
      <Building2 className="h-3 w-3" />
      {imported ? "Tenant · Imported" : "Tenant"}
    </Badge>
  );
}
