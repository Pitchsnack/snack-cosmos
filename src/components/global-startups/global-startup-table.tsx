import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { GlobalStartup } from "@/lib/api-gateway/global-startups";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-accent/10 text-accent border-accent/30",
  recommended: "bg-primary/10 text-primary border-primary/30",
  archived: "bg-muted text-muted-foreground/60",
};

export function GlobalStartupTable({
  items,
  linkTo = "control",
}: {
  items: GlobalStartup[];
  linkTo?: "control" | "browse" | "none";
  onImport?: (g: GlobalStartup) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No global startups match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Sector</th>
            <th className="px-4 py-2.5 font-medium">Stage</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Tags</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((g) => {
            const cell = (
              <>
                <td className="px-4 py-3">
                  <div className="font-medium">{g.name}</div>
                  {g.website && (
                    <div className="text-xs text-muted-foreground">
                      {g.website.replace(/^https?:\/\//, "")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{g.sector ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{g.stage ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={STATUS_TONE[g.status] ?? ""}>
                    {g.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {g.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    {g.tags.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{g.tags.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(g.updated_at).toLocaleDateString()}
                </td>
              </>
            );

            if (linkTo === "none") return <tr key={g.id}>{cell}</tr>;
            const to =
              linkTo === "browse"
                ? "/global-startups/browse"
                : "/global-startups/$id";
            return (
              <tr key={g.id} className="cursor-pointer hover:bg-muted/30">
                {linkTo === "control" ? (
                  <>
                    <td className="px-4 py-3">
                      <Link
                        to="/global-startups/$id"
                        params={{ id: g.id }}
                        className="block"
                      >
                        <div className="font-medium hover:text-accent">{g.name}</div>
                        {g.website && (
                          <div className="text-xs text-muted-foreground">
                            {g.website.replace(/^https?:\/\//, "")}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{g.sector ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{g.stage ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_TONE[g.status] ?? ""}>
                        {g.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(g.updated_at).toLocaleDateString()}
                    </td>
                  </>
                ) : (
                  cell
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* `to` is referenced to satisfy linkTo branch; rendered above as Link. */}
      <span className="hidden">{linkTo}</span>
    </div>
  );
}
