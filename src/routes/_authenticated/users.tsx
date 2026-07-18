import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listUsers, inviteUser } from "@/lib/users.functions";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { AgentImpactPanel } from "@/components/users/agent-impact-panel";
import { DefaultIntakeForm } from "@/components/settings/default-intake-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — SnackPortal2" }] }),
  component: UsersPage,
});

const INVITE_ROLES: AppRole[] = [
  "CONTROL",
  "MASTER_AGENT",
  "TENANT_ADMIN",
  "TENANT_AGENT",
  "STARTUP_USER",
  "INVESTOR_USER",
];

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Active"
      ? "bg-status-active/15 text-status-active border-status-active/30"
      : status === "Pending"
        ? "bg-status-draft/15 text-status-draft border-status-draft/30"
        : status === "Suspended" || status === "Locked"
          ? "bg-status-suspended/15 text-status-suspended border-status-suspended/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}

function UsersPage() {
  return (
    <PermissionGuard permission="users.read" message="You don't have permission to view users.">
      <UsersPageInner />
    </PermissionGuard>
  );
}

function UsersPageInner() {
  const { has } = usePermissions();
  const { data: session } = useSessionContext();
  const fetchUsers = useServerFn(listUsers);
  const tenantId = session?.activeWorkspace.tenantId ?? null;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["users", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            User Management
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenantId
              ? "Members of the active workspace."
              : "All users across the platform (Control view)."}
          </p>
        </div>
        {has("users.invite") && <InviteDialog onInvited={() => refetch()} />}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {u.user_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AgentImpactPanel />
    </div>
  );
}

function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const { data: session } = useSessionContext();
  const invite = useServerFn(inviteUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleCode, setRoleCode] = useState<AppRole>("TENANT_AGENT");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({
        data: {
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          tenantId: session?.activeWorkspace.tenantId ?? null,
          roleCode,
          redirectTo: `${window.location.origin}/accept-invite`,
        },
      });
      toast.success(`Invitation sent to ${email}`);
      setOpen(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      onInvited();
    } catch (err: any) {
      toast.error(err?.message ?? "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They'll receive an email to set their password and join.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs uppercase tracking-wide">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fn" className="text-xs uppercase tracking-wide">
                First name
              </Label>
              <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ln" className="text-xs uppercase tracking-wide">
                Last name
              </Label>
              <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Role</Label>
            <Select value={roleCode} onValueChange={(v) => setRoleCode(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !email}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {busy ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
