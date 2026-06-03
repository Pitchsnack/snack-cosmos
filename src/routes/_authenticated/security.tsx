import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Activity } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listSecurityEvents } from "@/lib/security.functions";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security — SnackPortal2" }] }),
  component: SecurityPage,
});

const EVENT_TONE: Record<string, string> = {
  LOGIN: "bg-status-active/15 text-status-active border-status-active/30",
  LOGOUT: "bg-muted text-muted-foreground border-border",
  FAILED_LOGIN: "bg-status-suspended/15 text-status-suspended border-status-suspended/30",
  PASSWORD_RESET: "bg-status-draft/15 text-status-draft border-status-draft/30",
  WORKSPACE_SWITCH: "bg-accent/15 text-accent border-accent/30",
  USER_INVITED: "bg-status-draft/15 text-status-draft border-status-draft/30",
  ROLE_CHANGE: "bg-accent/15 text-accent border-accent/30",
};

function SecurityPage() {
  return (
    <PermissionGuard permission="security.read" message="You don't have permission to view the security log.">
      <SecurityPageInner />
    </PermissionGuard>
  );
}

function SecurityPageInner() {
  const fetchEvents = useServerFn(listSecurityEvents);
  const { data, isLoading } = useQuery({
    queryKey: ["security-events"],
    queryFn: () => fetchEvents({ data: {} }),
  });



  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          Security
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Security events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Authentication, workspace switches, role changes, and account state changes.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Last 200 events
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">When</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No events yet.</TableCell></TableRow>
            ) : (
              (data ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={EVENT_TONE[e.event_type] ?? "border-border"}>
                      {e.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {e.user_id ? e.user_id.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {e.tenant_id ? e.tenant_id.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-[11px] text-muted-foreground">
                    {e.details ? JSON.stringify(e.details) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
