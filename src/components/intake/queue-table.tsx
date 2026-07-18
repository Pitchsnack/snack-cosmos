/**
 * Default Intake — Intake Queue table.
 *
 * Consumes the adapter's `listQueue()` capability. In the transitional
 * slice the adapter returns `{ available: false, reason }` — we render a
 * controlled empty state and disable actions. When the Queue backend
 * lands the same table lights up without a UI change.
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { defaultIntakeAdapter, type DefaultIntakeQueueItem } from "@/lib/default-intake";

export function QueueTable() {
  const query = useQuery({
    queryKey: ["default-intake-queue"],
    queryFn: () => defaultIntakeAdapter.listQueue(),
  });

  if (query.isLoading) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">Loading queue…</Card>
    );
  }
  const cap = query.data;
  if (!cap || cap.available === false) {
    return (
      <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-5 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <div className="font-medium text-foreground">Intake Queue not available</div>
          <p className="mt-1 text-muted-foreground">
            {cap?.reason ??
              "The Intake Queue persistence layer isn't available yet. Reassignment actions are disabled until it ships."}
          </p>
        </div>
      </Card>
    );
  }
  return <QueueList items={cap.data} />;
}

function QueueList({ items }: { items: DefaultIntakeQueueItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No records currently awaiting reassignment.
      </Card>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs capitalize text-muted-foreground">
                {r.domain} · {r.humanOwner.name} · {r.aiOwner.name}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
