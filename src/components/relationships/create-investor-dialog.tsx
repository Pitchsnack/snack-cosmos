import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvestor } from "@/lib/investors.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useHasSession } from "@/hooks/use-has-session";
import {
  DEFAULT_INTAKE_PREVIEW_ENABLED,
  assertNoDefaultIntakePreviewIds,
  getDefaultIntakePreviewConfiguration,
  isDefaultIntakePreviewId,
} from "@/lib/preview/default-intake-preview-adapter";
import { DefaultIntakeOwnershipPreview } from "@/components/intake/default-intake-ownership-preview";
import { DefaultIntakePreviewNotice } from "@/components/intake/default-intake-preview-notice";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initialName: string;
  /** Optional defaults inferred from parent form (e.g. startup ownership). */
  defaultAgentUserId?: string | null;
  defaultAiAgentId?: string | null;
  /** Called after the investor is created; parent replaces the pending row. */
  onCreated: (result: { id: string; name: string }) => void;
}

function displayName(u: { first_name: string | null; last_name: string | null; email: string }) {
  const nm = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return nm || u.email;
}

export function CreateInvestorDialog({
  open,
  onOpenChange,
  tenantId,
  initialName,
  defaultAgentUserId,
  defaultAiAgentId,
  onCreated,
}: Props) {
  const enabled = useHasSession();
  const fetchUsers = useServerFn(listAssignableUsers);
  const create = useServerFn(createInvestor);
  const qc = useQueryClient();

  // Preview-only defaults from the Default Intake fixture configuration.
  // These fixture IDs are visually preselected so the Owning Agent / AI Agent
  // fields are populated when the preview panel is displayed. They are never
  // sent to the server — `assertNoDefaultIntakePreviewIds` blocks the mutation
  // and the user must swap to a real assignable user before a real create.
  const previewConfig = DEFAULT_INTAKE_PREVIEW_ENABLED
    ? getDefaultIntakePreviewConfiguration()
    : null;
  const previewHuman = previewConfig?.investor.humanAgent ?? null;
  const previewAi = previewConfig?.investor.aiAgent ?? null;

  const [name, setName] = useState(initialName);
  const [agentId, setAgentId] = useState<string>("");
  const [aiAgentId, setAiAgentId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      // Investor-specific defaults only; Startup owners are never silently copied.
      setAgentId(defaultAgentUserId ?? previewHuman?.id ?? "");
      setAiAgentId(defaultAiAgentId ?? previewAi?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, defaultAgentUserId, defaultAiAgentId]);

  const humansQ = useQuery({
    queryKey: ["assignable-humans", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "Human" } }),
    enabled: enabled && open && !!tenantId,
  });
  const aisQ = useQuery({
    queryKey: ["assignable-ai", tenantId],
    queryFn: () => fetchUsers({ data: { tenantId, userType: "AI" } }),
    enabled: enabled && open && !!tenantId,
  });

  const humans = humansQ.data ?? [];
  const ais = aisQ.data ?? [];

  // Auto-select the sole option when there is exactly one and no preview default already fills it.
  useEffect(() => {
    if (!agentId && humans.length === 1) setAgentId(humans[0].id);
  }, [humans, agentId]);
  useEffect(() => {
    if (!aiAgentId && ais.length === 1) setAiAgentId(ais[0].id);
  }, [ais, aiAgentId]);

  const agentIsFixture = isDefaultIntakePreviewId(agentId);
  const aiAgentIsFixture = isDefaultIntakePreviewId(aiAgentId);
  const hasPreviewFixtureSelection = agentIsFixture || aiAgentIsFixture;

  const createM = useMutation({
    mutationFn: async () => {
      // Fixture-ID safety: never allow a Default Intake preview ID to
      // reach the relationship-sync mutation path.
      assertNoDefaultIntakePreviewIds([tenantId, agentId, aiAgentId]);
      const res = await create({
        data: {
          tenantId,
          investorName: name.trim(),
          owningAgentUserId: agentId,
          owningAiAgentId: aiAgentId,
        },
      });
      return res as { id: string };
    },
    onSuccess: (res) => {
      toast.success(`Investor "${name.trim()}" created`);
      qc.invalidateQueries({ queryKey: ["investors"] });
      onCreated({ id: res.id, name: name.trim() });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    !!name.trim() && !!agentId && !!aiAgentId && !hasPreviewFixtureSelection && !createM.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create investor</DialogTitle>
          <DialogDescription>
            Create a new investor record in this workspace and link it to the startup. You can edit
            the full profile later.
          </DialogDescription>
        </DialogHeader>
        {DEFAULT_INTAKE_PREVIEW_ENABLED && (
          <div className="space-y-2 py-1">
            <DefaultIntakePreviewNotice variant="compact" />
            <DefaultIntakeOwnershipPreview
              domain="investor"
              helperText="Creating the Investor and saving the relationship are separate actions. Startup owners are shown only as suggestions — Startup human and AI ownership are never silently copied to this Investor."
            />
            <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
              Suggested based on Startup relationship — you may still pick different owners below.
            </p>
          </div>
        )}
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="create-investor-name">Investor name</Label>
            <Input
              id="create-investor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Owning Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={humansQ.isLoading ? "Loading…" : "Select an agent"} />
              </SelectTrigger>
              <SelectContent>
                {previewHuman && (
                  <SelectItem value={previewHuman.id}>
                    {previewHuman.name} — Default Investor Intake Agent (preview)
                  </SelectItem>
                )}
                {humans.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {displayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentIsFixture && (
              <p className="text-[11px] text-muted-foreground">
                Preview default selected — swap to a real agent to enable a live create.
              </p>
            )}
            {!humansQ.isLoading && humans.length === 0 && !previewHuman && (
              <p className="text-xs text-destructive">No assignable agents in this workspace.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Owning AI Agent</Label>
            <Select value={aiAgentId} onValueChange={setAiAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={aisQ.isLoading ? "Loading…" : "Select an AI agent"} />
              </SelectTrigger>
              <SelectContent>
                {previewAi && (
                  <SelectItem value={previewAi.id}>
                    {previewAi.name} — Default Investor Intake AI Agent (preview)
                  </SelectItem>
                )}
                {ais.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {displayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aiAgentIsFixture && (
              <p className="text-[11px] text-muted-foreground">
                Preview default selected — swap to a real AI agent to enable a live create.
              </p>
            )}
            {!aisQ.isLoading && ais.length === 0 && !previewAi && (
              <p className="text-xs text-destructive">No assignable AI agents in this workspace.</p>
            )}
          </div>
          {hasPreviewFixtureSelection && (
            <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
              Default Intake preview owners are fixture values only. Select real Owning Agent and
              Owning AI Agent records to create this investor.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createM.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => createM.mutate()} disabled={!canSubmit}>
            {createM.isPending
              ? "Creating…"
              : hasPreviewFixtureSelection
                ? "Select real owners"
                : "Create investor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
