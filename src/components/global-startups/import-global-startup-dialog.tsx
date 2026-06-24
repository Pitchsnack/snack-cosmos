import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import { useGlobalStartupImports } from "@/hooks/use-global-startup";
import { useImportGlobalStartup } from "@/hooks/use-import-global-startup";
import type { GlobalStartup } from "@/lib/api-gateway/global-startups";

interface AssignableUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function displayName(u: AssignableUser) {
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || u.email;
}

export function ImportGlobalStartupDialog({
  open,
  onOpenChange,
  global,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  global: GlobalStartup | null;
}) {
  const { data: session } = useSessionContext();
  const activeTenant = session?.activeWorkspace ?? null;
  const tenantId = activeTenant?.tenantId ?? null;
  const tenantName = activeTenant?.tenantName ?? null;

  const listAssignable = useServerFn(listAssignableUsers);

  const humansQ = useQuery({
    queryKey: ["assignable-users", tenantId, "Human"],
    queryFn: () =>
      listAssignable({ data: { tenantId: tenantId!, userType: "Human" } }),
    enabled: open && !!tenantId,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-users", tenantId, "AI"],
    queryFn: () =>
      listAssignable({ data: { tenantId: tenantId!, userType: "AI" } }),
    enabled: open && !!tenantId,
  });

  const importsQ = useGlobalStartupImports(open ? global?.id : undefined);
  const alreadyImported = useMemo(() => {
    if (!tenantId || !importsQ.data) return false;
    return importsQ.data.some((i) => i.tenant_id === tenantId);
  }, [importsQ.data, tenantId]);

  const humans = (humansQ.data ?? []) as AssignableUser[];
  const ais = (aisQ.data ?? []) as AssignableUser[];

  const [agentId, setAgentId] = useState<string>("");
  const [aiId, setAiId] = useState<string>("");

  // Prefill caller as owning Agent if they are an eligible human in the
  // active tenant.
  useEffect(() => {
    if (!open) return;
    const me = session?.user?.id ?? null;
    if (!agentId && me && humans.some((u) => u.id === me)) setAgentId(me);
  }, [open, session, humans, agentId]);

  useEffect(() => {
    if (!open) {
      setAgentId("");
      setAiId("");
    }
  }, [open]);

  const importM = useImportGlobalStartup();

  const noAi = aisQ.isSuccess && ais.length === 0;
  const noAgent = humansQ.isSuccess && humans.length === 0;
  const ownershipBlocked = noAi || noAgent;
  const canImport =
    !!global &&
    !!tenantId &&
    !alreadyImported &&
    !ownershipBlocked &&
    !!agentId &&
    !!aiId &&
    !importM.isPending;

  const handleImport = () => {
    if (!global || !canImport) return;
    importM.mutate(
      {
        globalId: global.id,
        owningAgentUserId: agentId,
        owningAiAgentId: aiId,
      },
      {
        onSuccess: () => {
          toast.success(`Imported "${global.name}" into ${tenantName ?? "workspace"}`);
          onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import to workspace</DialogTitle>
          <DialogDescription>
            Creates an independent tenant-owned copy of this startup. There is
            no automatic sync — later edits to the global record will not
            update your copy, and your edits will not update the global
            record.
          </DialogDescription>
        </DialogHeader>

        {!global ? null : (
          <div className="space-y-4">
            <Row label="Source">
              <div className="text-sm font-medium">{global.name}</div>
              <div className="text-xs text-muted-foreground">
                {[global.sector, global.stage].filter(Boolean).join(" · ") || "—"}
              </div>
            </Row>

            <Row label="Target tenant">
              <div className="text-sm">{tenantName ?? "(no active tenant)"}</div>
            </Row>

            {alreadyImported && (
              <Banner tone="info">
                <CheckCircle2 className="h-4 w-4" />
                Already imported into this tenant.
              </Banner>
            )}

            {ownershipBlocked && !alreadyImported && (
              <Banner tone="error">
                <AlertTriangle className="h-4 w-4" />
                {noAi
                  ? "This tenant has no AI Agent user available. Import is blocked."
                  : "This tenant has no eligible Agent user. Import is blocked."}
              </Banner>
            )}

            {!alreadyImported && !ownershipBlocked && (
              <>
                <Row label="Owning Agent">
                  <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {humans.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {displayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>

                <Row label="Owning AI Agent">
                  <Select value={aiId} onValueChange={setAiId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an AI Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {ais.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {displayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {importM.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-accent/30 bg-accent/10 text-accent";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${cls}`}>
      {children}
    </div>
  );
}
