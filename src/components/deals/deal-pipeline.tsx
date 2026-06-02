import { Link } from "@tanstack/react-router";
import { DEAL_STAGES, type DealListItem } from "@/lib/deals.functions";
import { Badge } from "@/components/ui/badge";

export function DealPipeline({ rows }: { rows: DealListItem[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: `${DEAL_STAGES.length * 240}px` }}>
        {DEAL_STAGES.map((stage) => {
          const items = rows.filter((r) => r.stage === stage);
          return (
            <div key={stage} className="w-60 shrink-0 rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage}</div>
                <Badge variant="outline" className="text-xs">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">Empty</div>
                ) : (
                  items.map((d) => (
                    <Link
                      key={d.id}
                      to="/deals/$id"
                      params={{ id: d.id }}
                      className="block rounded-md border border-border bg-card p-3 shadow-card hover:border-accent hover:shadow-md"
                    >
                      <div className="text-sm font-medium truncate">{d.deal_name}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{d.startup_name} → {d.investor_name}</div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{d.probability != null ? `${d.probability}%` : "—"}</span>
                        <span>{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : ""}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
