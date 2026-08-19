/**
 * Create a real Startup record and link it to the current Investor's
 * Investment Portfolio.
 *
 * Mirrors `create-investor-dialog.tsx` from the startup side: Default Intake
 * settings preselect the *startup-domain* Human + AI owners, and
 * `assertNoFixtureIds` blocks mock-adapter IDs from reaching the mutation.
 */
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStartup, createStartupMediaUploadUrl } from "@/lib/startups.functions";
import { listAssignableUsers } from "@/lib/startup-ownership.functions";
import { useHasSession } from "@/hooks/use-has-session";
import { assertNoFixtureIds, defaultIntakeAdapter } from "@/lib/default-intake";
import { supabase } from "@/integrations/supabase/client";
import { LogoSlot, EMPTY_SLOT, type SlotState } from "@/components/media/entity-media-editor";
import { EditableUrlField } from "@/components/ui/editable-url-field";
import { useWebsiteDuplicateCheck } from "@/hooks/use-website-duplicate-check";
import { DuplicateWarningDialog } from "@/components/relationships/duplicate-warning-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initialName: string;
  onCreated: (result: { id: string; name: string }) => void;
}

function displayName(u: { first_name: string | null; last_name: string | null; email: string }) {
  const nm = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return nm || u.email;
}

export function CreateStartupDialog({
  open,
  onOpenChange,
  tenantId,
  initialName,
  onCreated,
}: Props) {
  const enabled = useHasSession();
  const fetchUsers = useServerFn(listAssignableUsers);
  const create = useServerFn(createStartup);
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ["default-intake", tenantId],
    queryFn: () => defaultIntakeAdapter.getConfiguration(),
    enabled: enabled && open && !!tenantId,
    staleTime: 60_000,
  });
  const cfg = configQ.data ?? null;
  const startupDefaults = cfg
    ? { humanId: cfg.startup.humanAgent.id, aiId: cfg.startup.aiAgent.id }
    : null;

  const [name, setName] = useState(initialName);
  const [shortDescription, setShortDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoSlot, setLogoSlot] = useState<SlotState>(EMPTY_SLOT);
  const logoFile = logoSlot.pendingFile;
  const [agentId, setAgentId] = useState<string>("");
  const [aiAgentId, setAiAgentId] = useState<string>("");
  const [useDefaultIntake, setUseDefaultIntake] = useState<boolean>(true);

  const getUploadUrl = useServerFn(createStartupMediaUploadUrl);
  const websiteDup = useWebsiteDuplicateCheck();
  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : null;

  useEffect(() => {
    if (open) {
      setName(initialName);
      setShortDescription("");
      setWebsiteUrl("");
      setLogoSlot(EMPTY_SLOT);
      const useIt = !!startupDefaults;
      setUseDefaultIntake(useIt);
      setAgentId(useIt ? startupDefaults!.humanId : "");
      setAiAgentId(useIt ? startupDefaults!.aiId : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, startupDefaults?.humanId, startupDefaults?.aiId]);

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

  useEffect(() => {
    if (!agentId && humans.length === 1) setAgentId(humans[0].id);
  }, [humans, agentId]);
  useEffect(() => {
    if (!aiAgentId && ais.length === 1) setAiAgentId(ais[0].id);
  }, [ais, aiAgentId]);

  const createM = useMutation({
    mutationFn: async () => {
      assertNoFixtureIds([tenantId, agentId, aiAgentId]);

      let logoPath: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
        const { path, token } = await getUploadUrl({
          data: { tenantId, kind: "logo", ext },
        });
        const { error } = await supabase.storage
          .from("startup-media")
          .uploadToSignedUrl(path, token, logoFile, {
            contentType: logoFile.type || "image/png",
            upsert: true,
          });
        if (error) throw new Error("Logo upload failed: " + error.message);
        logoPath = path;
      }

      const res = await create({
        data: {
          tenantId,
          startupName: name.trim(),
          shortDescription: shortDescription.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          logoPath,
          owningAgentUserId: agentId,
          owningAiAgentId: aiAgentId,
        },
      });
      return res as { id: string };
    },
    onSuccess: (res) => {
      toast.success(`Startup "${name.trim()}" created`);
      qc.invalidateQueries({ queryKey: ["startups"] });
      onCreated({ id: res.id, name: name.trim() });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!name.trim() && !!agentId && !!aiAgentId && !createM.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create startup</DialogTitle>
          <DialogDescription>
            Create a new startup record in this workspace and link it to this investor's
            portfolio. You can edit the full profile later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="create-startup-name">Company name</Label>
            <Input
              id="create-startup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <EditableUrlField
            label="Company URL (optional)"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            onCommit={(url) => void websiteDup.check(url)}
            placeholder="https://example.com"
          />
          <LogoSlot
            value={logoSlot}
            onChange={(s) => setLogoSlot(s)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="create-startup-desc">
              Short description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="create-startup-desc"
              rows={3}
              maxLength={500}
              placeholder="One or two sentences about the company"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>
          {startupDefaults && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5">
              <Checkbox
                id="use-default-intake-startup"
                checked={useDefaultIntake}
                onCheckedChange={(v) => {
                  const checked = v === true;
                  setUseDefaultIntake(checked);
                  if (checked) {
                    setAgentId(startupDefaults.humanId);
                    setAiAgentId(startupDefaults.aiId);
                  } else {
                    setAgentId("");
                    setAiAgentId("");
                  }
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="use-default-intake-startup"
                className="cursor-pointer text-sm font-normal leading-snug"
              >
                Use Default Intake Assignment
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Auto-fill Owning Agent and Owning AI Agent with this tenant's configured
                  Default Startup Intake owners. Untick to pick manually.
                </span>
              </Label>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Owning Agent</Label>
            <Select
              value={agentId}
              disabled={useDefaultIntake}
              onValueChange={(v) => {
                setAgentId(v);
                if (useDefaultIntake && v !== startupDefaults?.humanId) setUseDefaultIntake(false);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    useDefaultIntake
                      ? "Using default intake agent"
                      : humansQ.isLoading
                        ? "Loading…"
                        : "Select an agent"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {humans.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {displayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!humansQ.isLoading && humans.length === 0 && (
              <p className="text-xs text-destructive">No assignable agents in this workspace.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Owning AI Agent</Label>
            <Select
              value={aiAgentId}
              disabled={useDefaultIntake}
              onValueChange={(v) => {
                setAiAgentId(v);
                if (useDefaultIntake && v !== startupDefaults?.aiId) setUseDefaultIntake(false);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    useDefaultIntake
                      ? "Using default intake AI agent"
                      : aisQ.isLoading
                        ? "Loading…"
                        : "Select an AI agent"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {ais.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {displayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!aisQ.isLoading && ais.length === 0 && (
              <p className="text-xs text-destructive">
                No assignable AI agents in this workspace.
              </p>
            )}
          </div>
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
            {createM.isPending ? "Creating…" : "Create startup"}
          </Button>
        </DialogFooter>
        <DuplicateWarningDialog
          open={websiteDup.open}
          typedName={websiteDup.typedValue}
          candidates={websiteDup.candidates}
          onCancel={websiteDup.close}
          onLinkExisting={(c) => {
            websiteDup.close();
            if (c.id) window.open(`/startups/${c.id}`, "_blank", "noopener,noreferrer");
          }}
          onCreatePendingAnyway={websiteDup.close}
        />
      </DialogContent>
    </Dialog>
  );
}
