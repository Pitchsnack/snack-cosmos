import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Check, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type AppRole,
  type Permission,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/access-management")({
  head: () => ({ meta: [{ title: "Access Management — SnackPortal2" }] }),
  component: AccessPage,
});

const ROLE_GROUPS: { label: string; roles: AppRole[] }[] = [
  { label: "Control Plane", roles: ["CONTROL", "CONTROL_RESEARCH_AI", "CONTROL_STARTUP_DISCOVERY_AI", "CONTROL_INVESTOR_DISCOVERY_AI"] },
  { label: "Master Agent", roles: ["MASTER_AGENT", "MASTER_AGENT_AI"] },
  { label: "Tenant", roles: ["TENANT_ADMIN", "TENANT_AGENT", "TENANT_STARTUP_AI", "TENANT_INVESTOR_AI", "TENANT_DEAL_AI"] },
  { label: "Portal", roles: ["STARTUP_USER", "INVESTOR_USER"] },
];

const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Tenants", perms: ["tenants.read", "tenants.write", "tenants.delete"] },
  { label: "Users", perms: ["users.read", "users.invite", "users.suspend", "users.assign_role"] },
  { label: "Roles", perms: ["roles.read", "roles.assign"] },
  { label: "Platform", perms: ["security.read", "audit.read", "workspace.switch"] },
  { label: "Startups", perms: ["startups.read", "startups.write"] },
  { label: "Investors", perms: ["investors.read", "investors.write"] },
  { label: "Deals", perms: ["deals.read", "deals.write"] },
  { label: "AI", perms: ["ai.invoke"] },
];

function AccessPage() {
  return (
    <PermissionGuard
      permission="roles.read"
      allowControl
      message="You don't have permission to view access management."
    >
      <AccessPageInner />
    </PermissionGuard>
  );
}

function AccessPageInner() {
  const { has, isControl } = usePermissions();


  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Access Control
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Access Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Role-to-permission matrix. Roles and permissions are app-owned and platform-agnostic.
        </p>
      </div>

      {ROLE_GROUPS.map((group) => (
        <div key={group.label} className="rounded-lg border border-border bg-card shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{group.label}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Role</TableHead>
                  {PERMISSION_GROUPS.map((g) => (
                    <TableHead key={g.label} className="text-center text-xs">{g.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.roles.map((role) => (
                  <TableRow key={role}>
                    <TableCell>
                      <div className="font-medium">{ROLE_LABELS[role]}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{role}</div>
                    </TableCell>
                    {PERMISSION_GROUPS.map((g) => {
                      const granted = g.perms.filter((p) => ROLE_PERMISSIONS[role].includes(p));
                      const all = granted.length === g.perms.length;
                      const some = granted.length > 0;
                      return (
                        <TableCell key={g.label} className="text-center">
                          {all ? (
                            <Check className="mx-auto h-4 w-4 text-status-active" />
                          ) : some ? (
                            <Badge variant="outline" className="text-[10px]">{granted.length}/{g.perms.length}</Badge>
                          ) : (
                            <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
