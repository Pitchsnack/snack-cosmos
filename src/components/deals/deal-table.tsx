import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { DealListItem } from "@/lib/deals.functions";
import { Sparkles } from "lucide-react";

function stageTone(s: string) {
  switch (s) {
    case "Invested":
    case "Closed": return "bg-success/15 text-success border-success/30";
    case "Term Sheet":
    case "Negotiation": return "bg-accent/15 text-accent border-accent/30";
    case "Rejected":
    case "Paused": return "bg-warning/20 text-warning-foreground border-warning/40";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function DealTable({ rows, isLoading }: { rows: DealListItem[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Deal</TableHead>
            <TableHead>Startup</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead>Expected Close</TableHead>
            <TableHead>Owning Agent</TableHead>
            <TableHead>AI Owner</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && rows.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} aria-hidden="true">
                {Array.from({ length: 9 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full max-w-[10rem]" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-14 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                  <Sparkles className="h-8 w-8 opacity-60" />
                  <p className="text-sm">No deals yet. Create the first one.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((d) => (
              <TableRow key={d.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <Link to="/deals/$id" params={{ id: d.id }} className="hover:underline">
                    {d.deal_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{d.tenant_name}</div>
                </TableCell>
                <TableCell className="text-sm">{d.startup_name || "—"}</TableCell>
                <TableCell className="text-sm">{d.investor_name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className={stageTone(d.stage)}>{d.stage}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.probability != null ? `${d.probability}%` : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-sm">{d.owning_agent?.name || d.owning_agent?.email || <span className="text-destructive">Missing</span>}</TableCell>
                <TableCell className="text-sm">{d.owning_ai_agent?.name || d.owning_ai_agent?.email || <span className="text-destructive">Missing</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(d.updated_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
