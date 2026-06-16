import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { SharedDealListItem } from "@/lib/deal-shares.functions";

function statusTone(s: string | null) {
  switch (s) {
    case "Accepted": return "bg-success/15 text-success border-success/30";
    case "Rejected":
    case "Withdrawn":
    case "Expired": return "bg-warning/20 text-warning-foreground border-warning/40";
    case "Viewed": return "bg-accent/15 text-accent border-accent/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function SharedDealTable({
  rows, isLoading,
}: { rows: SharedDealListItem[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Direction</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Startup</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>Origin Tenant</TableHead>
            <TableHead>Target Tenant</TableHead>
            <TableHead>Shared By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
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
                  <Share2 className="h-8 w-8 opacity-60" />
                  <p className="text-sm">No shared deals yet.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.shareId}-${r.targetId ?? "all"}`} className="hover:bg-muted/30">
                <TableCell>
                  {r.direction === "incoming" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-accent">
                      <ArrowDownLeft className="h-3.5 w-3.5" /> Incoming
                    </span>
                  ) : r.direction === "outgoing" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Outgoing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">Both</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link to="/shared-deals/$id" params={{ id: r.shareId }} className="hover:underline">
                    {r.dealName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.stage}</div>
                </TableCell>
                <TableCell className="text-sm">{r.startupName || "—"}</TableCell>
                <TableCell className="text-sm">{r.investorName || "—"}</TableCell>
                <TableCell className="text-sm">{r.originTenantName || "—"}</TableCell>
                <TableCell className="text-sm">{r.targetTenantName || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.sharedByEmail || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusTone(r.targetStatus ?? r.shareStatus)}>
                    {r.targetStatus ?? r.shareStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
