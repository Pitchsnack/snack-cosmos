import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { assignStartupUser, removeStartupUser } from "@/lib/startup-users.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { usePermissions } from "@/hooks/use-session-context";

type Assignment = {
  id: string; user_id: string; role: string | null; created_at: string;
  users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
};

export function StartupUsersCard({
  startupId, tenantId, assignments,
}: { startupId: string; tenantId: string; assignments: Assignment[] }) {
  const { isControl, has } = usePermissions();
  const canManage = isControl || has("users.assign_role");
  const qc = useQueryClient();
  const remove = useServerFn(removeStartupUser);
  const removeM = useMutation({
    mutationFn: (assignmentId: string) => remove({ data: { startupId, assignmentId } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["startup", startupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Startup Users</div>
          <p className="mt-1 text-xs text-muted-foreground">Founders, executives, and team members with portal access.</p>
        </div>
        {canManage && <AssignDialog startupId={startupId} tenantId={tenantId} />}
      </div>
      <div className="mt-4 divide-y divide-border">
        {assignments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No users assigned yet.</p>
        ) : assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium">{[a.users?.first_name, a.users?.last_name].filter(Boolean).join(" ") || a.users?.email}</div>
              <div className="text-xs text-muted-foreground">{a.users?.email} · {a.role || "Member"}</div>
            </div>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => removeM.mutate(a.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignDialog({ startupId, tenantId }: { startupId: string; tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("Founder");
  const qc = useQueryClient();
  const enabled = useHasSession();
  const fetchUsers = useServerFn(listAssignableUsers);
  const assign = useServerFn(assignStartupUser);

  const usersQ = useQuery({
    queryKey: ["assignable-humans-tenant", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && open,
  });

  const m = useMutation({
    mutationFn: () => assign({ data: { startupId, userId, role } }),
    onSuccess: () => {
      toast.success("User assigned");
      qc.invalidateQueries({ queryKey: ["startup", startupId] });
      setOpen(false); setUserId(""); setRole("Founder");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Assign user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign a startup user</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder={usersQ.isLoading ? "Loading…" : "Pick a user"} /></SelectTrigger>
              <SelectContent>
                {(usersQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Founder, CEO, CTO…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!userId || !role || m.isPending} onClick={() => m.mutate()} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {m.isPending ? "Saving…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
