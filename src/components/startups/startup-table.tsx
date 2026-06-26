import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { StartupListItem } from "@/lib/startups.functions";
import { Rocket } from "lucide-react";

function statusTone(s: string) {
  switch (s) {
    case "Active":
    case "Portfolio": return "bg-success/15 text-success border-success/30";
    case "Fundraising":
    case "Due Diligence": return "bg-accent/15 text-accent border-accent/30";
    case "Draft": return "bg-muted text-muted-foreground border-border";
    case "Exited": return "bg-primary/10 text-primary border-primary/30";
    case "Inactive":
    case "Archived": return "bg-warning/20 text-warning-foreground border-warning/40";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function StartupTable({ rows, isLoading }: { rows: StartupListItem[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Startup</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Owning Agent</TableHead>
            <TableHead>AI Owner</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-14 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                  <Rocket className="h-8 w-8 opacity-60" />
                  <p className="text-sm">No startups yet. Create the first one.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <Link to="/startups/$id" params={{ id: s.id }} className="hover:underline">
                    {s.startup_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{s.tenant_name}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.city || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.industry?.length ? s.industry.join(", ") : "—"}</TableCell>
                <TableCell><Badge variant="outline" className={statusTone(s.status)}>{s.status}</Badge></TableCell>
                <TableCell className="text-sm">{s.owning_agent?.name || s.owning_agent?.email || <span className="text-destructive">Missing</span>}</TableCell>
                <TableCell className="text-sm">{s.owning_ai_agent?.name || s.owning_ai_agent?.email || <span className="text-destructive">Missing</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
