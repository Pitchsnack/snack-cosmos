import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { reassignInvestorOwner, reassignInvestorAiOwner } from "@/lib/investor-ownership.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { usePermissions } from "@/hooks/use-session-context";

type Person = { id: string; email: string; first_name: string | null; last_name: string | null } | null;

export function InvestorOwnershipCard({
  investorId, tenantId, owner, aiOwner,
}: { investorId: string; tenantId: string; owner: Person; aiOwner: Person }) {
  const { isControl, has } = usePermissions();
  const canManage = isControl || has("users.assign_role");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OwnerBlock title="Owning Agent" person={owner} canManage={canManage} investorId={investorId} tenantId={tenantId} userType="Human" />
      <OwnerBlock title="Owning AI Agent" person={aiOwner} canManage={canManage} investorId={investorId} tenantId={tenantId} userType="AI" />
    </div>
  );
}

function OwnerBlock({
  title, person, canManage, investorId, tenantId, userType,
}: {
  title: string; person: Person; canManage: boolean;
  investorId: string; tenantId: string; userType: "Human" | "AI";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 text-base font-medium">
        {person ? ([person.first_name, person.last_name].filter(Boolean).join(" ") || person.email) : <span className="text-destructive">Missing</span>}
      </div>
      {person && <div className="text-xs text-muted-foreground">{person.email}</div>}
      {canManage && (
        <div className="mt-3">
          <ReassignDialog investorId={investorId} tenantId={tenantId} userType={userType} label={person ? "Reassign" : "Assign"} />
        </div>
      )}
    </div>
  );
}

function ReassignDialog({
  investorId, tenantId, userType, label,
}: { investorId: string; tenantId: string; userType: "Human" | "AI"; label: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const qc = useQueryClient();
  const enabled = useHasSession();
  const fetchUsers = useServerFn(listAssignableUsers);
  const reassign = useServerFn(reassignInvestorOwner);
  const reassignAi = useServerFn(reassignInvestorAiOwner);

  const usersQ = useQuery({
    queryKey: ["assignable", userType, tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType } }),
    enabled: enabled && open,
  });

  const m = useMutation({
    mutationFn: async () => {
      if (userType === "Human") return reassign({ data: { investorId, owningAgentUserId: selected } });
      return reassignAi({ data: { investorId, owningAiAgentId: selected } });
    },
    onSuccess: () => {
      toast.success("Ownership updated");
      qc.invalidateQueries({ queryKey: ["investor", investorId] });
      qc.invalidateQueries({ queryKey: ["investors"] });
      setOpen(false);
      setSelected("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} {userType === "AI" ? "AI Owner" : "Owning Agent"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide">Select user</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder={usersQ.isLoading ? "Loading…" : "Pick a user"} /></SelectTrigger>
            <SelectContent>
              {(usersQ.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!selected || m.isPending} onClick={() => m.mutate()} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
