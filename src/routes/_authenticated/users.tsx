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
import { listUsers, inviteUser, updateUserStatus, permanentlyDeleteUser, listPlans, setUserAccess } from "@/lib/users.functions";
import { usePermissions, useSessionContext } from "@/hooks/use-session-context";
import { PermissionGuard } from "@/components/permission-guard";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { AgentImpactPanel } from "@/components/users/agent-impact-panel";
import { DefaultIntakeForm } from "@/components/settings/default-intake-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanBadge } from "@/components/plan-badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — PitchSnack" }] }),
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

const USER_STATUSES = [
  "Pending",
  "Active",
  "Suspended",
  "Locked",
  "Archived",
  "Deleted",
] as const;

function StatusSelect({
  userId,
  status,
  onChanged,
}: {
  userId: string;
  status: string;
  onChanged: () => void;
}) {
  const update = useServerFn(updateUserStatus);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === status) return;
    setBusy(true);
    try {
      await update({
        data: { targetUserId: userId, status: next as (typeof USER_STATUSES)[number] },
      });
      toast.success(`Status set to ${next}`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  const purge = useServerFn(permanentlyDeleteUser);
  async function hardDelete() {
    if (!window.confirm("Permanently delete this account? This cannot be undone. The email can then be used to sign up again as a brand-new account.")) return;
    setBusy(true);
    try {
      await purge({ data: { targetUserId: userId } });
      toast.success("Account permanently deleted");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
    <Select value={status} onValueChange={change} disabled={busy}>
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USER_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {status === "Deleted" && (
      <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={busy} onClick={hardDelete}>
        Permanently delete
      </Button>
    )}
    </div>
  );
}

type AccRole = "seller" | "buyer" | "advisor" | "admin";
const ROLE_PILL: Record<AccRole, string> = { seller: "bg-[#FEF3DE] text-[#8A4B06]", buyer: "bg-[#EEF0FF] text-[#4338CA]", advisor: "bg-[#E0F5F2] text-[#0F766E]", admin: "bg-[#E8EBF2] text-[#192957]" };
const OPENS: Record<AccRole, string> = { seller: "Seller tab only", buyer: "Buyer tab only", advisor: "Advisor tab only", admin: "Admin and all three tabs" };
const ROLE_LINE: Record<AccRole, string> = { seller: "Opens the Seller tab only", buyer: "Opens the Buyer tab only", advisor: "Opens the Advisor tab only", admin: "Opens Admin and all three tabs, with no plan limits" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
function priceText(p: any) {
  if (p.price_type === "free") return "free";
  if (p.price_type === "on_request") return "on request";
  return `${Number(p.price_thb).toLocaleString("en-US")} THB / ${p.term_months === 12 ? "yr" : `${p.term_months} mo`}`;
}
const fmtDay = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function RolePill({ role }: { role: AccRole | null }) {
  if (!role) return <span className="text-xs text-muted-foreground">Role to set</span>;
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[.06em]", ROLE_PILL[role])}>{role}</span>;
}

function AccessDialog({ u, plans, admins, onClose, onSaved }: { u: any; plans: any[]; admins: any[]; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(setUserAccess);
  const [role, setRole] = useState<AccRole | null>(u.account_role ?? null);
  const [planId, setPlanId] = useState<string | null>(u.subscription?.plan_id ?? null);
  const [manager, setManager] = useState<string | null>(u.subscription?.manager_user_id ?? null);
  const [busy, setBusy] = useState(false);
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
  const choices = role && role !== "admin" ? plans.filter((p) => p.role === role && (p.status === "live" || p.id === u.subscription?.plan_id)) : [];
  const plan = plans.find((p) => p.id === planId);
  const pickRole = (r: AccRole) => {
    setRole(r);
    if (r !== u.account_role) setPlanId(r === "admin" ? null : plans.find((p) => p.role === r && p.status === "live")?.id ?? null);
    else setPlanId(u.subscription?.plan_id ?? null);
  };
  const submit = async () => {
    if (!role) return;
    setBusy(true);
    try {
      await save({ data: { targetUserId: u.id, role, planId: role === "admin" ? null : planId, managerUserId: plan?.has_manager ? manager : null } });
      toast.success(`Saved. ${name} now opens the ${role === "admin" ? "Admin and all three" : cap(role)} tab${role === "admin" ? "s" : ""}${plan && role !== "admin" ? `, on the ${plan.name} plan` : ""}.`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{u.email}</DialogDescription>
        </DialogHeader>
        <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-foreground">Role · one per account</div>
        <div className="grid gap-2">
          {(["seller", "buyer", "advisor", "admin"] as AccRole[]).map((r) => (
            <button key={r} type="button" onClick={() => pickRole(r)} className={cn("rounded-lg border px-3 py-2 text-left", role === r ? "border-[#192957] ring-1 ring-inset ring-[#192957]" : "border-border hover:bg-muted/50")}>
              <div className="text-sm font-semibold">{cap(r)}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LINE[r]}</div>
            </button>
          ))}
        </div>
        {role && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Plan</Label>
            {role === "admin" ? (
              <p className="text-sm text-muted-foreground">Admins have no plan and no limits.</p>
            ) : (
              <>
                <Select value={planId ?? ""} onValueChange={(v) => setPlanId(v)}>
                  <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                  <SelectContent>
                    {choices.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {priceText(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {role === "buyer" && <p className="text-xs text-muted-foreground">Every buyer is on a paid plan.</p>}
                {u.subscription?.status === "ended" && planId === u.subscription.plan_id && (
                  <p className="text-xs text-muted-foreground"><b>Plan ended {u.subscription.term_end ? fmtDay(u.subscription.term_end) : ""}.</b> The user can look around but can't send requests until it's renewed.</p>
                )}
                {plan?.has_manager && (
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs uppercase tracking-wide">Manager</Label>
                    <Select value={manager ?? ""} onValueChange={(v) => setManager(v)}>
                      <SelectTrigger><SelectValue placeholder="Choose a manager" /></SelectTrigger>
                      <SelectContent>{admins.map((a) => <SelectItem key={a.id} value={a.id}>{[a.first_name, a.last_name].filter(Boolean).join(" ") || a.email}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !role} onClick={submit}>{busy ? "Saving…" : "Save access"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { has, isControl } = usePermissions();
  const canEditStatus = isControl || has("users.suspend");
  const { data: session } = useSessionContext();
  const fetchUsers = useServerFn(listUsers);
  const tenantId = session?.activeWorkspace.tenantId ?? null;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["users", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId } }),
  });
  const plansFn = useServerFn(listPlans);
  const { data: plans = [] } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() });
  const planById = Object.fromEntries(plans.map((p: any) => [p.id, p]));
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const all = (data ?? []) as any[];
  const live = all.filter((u) => u.status !== "Deleted");
  const needsPlan = (u: any) => (u.account_role === "buyer" || u.account_role === "advisor") && !u.subscription;
  const counts: Record<string, number> = {
    all: all.length,
    seller: live.filter((u) => u.account_role === "seller").length,
    buyer: live.filter((u) => u.account_role === "buyer").length,
    advisor: live.filter((u) => u.account_role === "advisor").length,
    admin: live.filter((u) => u.account_role === "admin").length,
    role: live.filter((u) => !u.account_role).length,
    plan: live.filter(needsPlan).length,
  };
  const rows = all.filter((u) => filter === "all" ? true : filter === "role" ? u.status !== "Deleted" && !u.account_role : filter === "plan" ? u.status !== "Deleted" && needsPlan(u) : u.account_role === filter);
  const admins = live.filter((u) => u.account_role === "admin");
  const chips: [string, string][] = [["all", "All"], ["seller", "Sellers"], ["buyer", "Buyers"], ["advisor", "Advisors"], ["admin", "Admins"], ["role", "Role to set"], ["plan", "Plan to set"]];

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

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          {has("default_intake.read") && (
            <TabsTrigger value="default-intake">Default Intake</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {chips.filter(([k]) => !(k === "role" || k === "plan") || counts[k] > 0).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === k ? "border-[#192957] bg-[#192957] text-white" : "border-border bg-card hover:bg-muted")}>
                {l} {counts[k]}
              </button>
            ))}
          </div>
          {editing && <AccessDialog u={editing} plans={plans} admins={admins} onClose={() => setEditing(null)} onSaved={() => refetch()} />}
          <div className="rounded-lg border border-border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((u: any) => (
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
                        {canEditStatus ? (
                          <StatusSelect
                            userId={u.id}
                            status={u.status}
                            onChanged={() => refetch()}
                          />
                        ) : (
                          <StatusBadge status={u.status} />
                        )}
                      </TableCell>
                      <TableCell>
                        <RolePill role={u.account_role ?? null} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const p = u.subscription ? planById[u.subscription.plan_id] : null;
                          return p && u.account_role !== "admin" ? <PlanBadge name={p.name} style={p.badge_style} ended={u.subscription.status === "ended"} /> : <span className="text-xs text-muted-foreground">{needsPlan(u) ? "Plan to set" : "—"}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{u.account_role ? OPENS[u.account_role as AccRole] : "—"}</span>
                          {isControl && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(u)}>Edit access</Button>}
                        </div>
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
        </TabsContent>

        {has("default_intake.read") && (
          <TabsContent value="default-intake" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Default Intake Assignment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the default human and AI owners used when a Startup or Investor is created
                without final ownership. Scoped to the active tenant workspace.
              </p>
            </div>
            <DefaultIntakeForm />
          </TabsContent>
        )}
      </Tabs>
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
