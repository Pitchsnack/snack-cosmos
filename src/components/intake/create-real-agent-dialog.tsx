/**
 * Create Real Agent from Preview Template — dialog.
 *
 * PREVIEW UX ONLY. Renders a setup form (Human or AI variant) whose submit
 * action does NOT create a real user, membership, or ownership record. The
 * fixture ID that seeded the form is never sent anywhere; it exists purely
 * as a display template. When the backend provisioning boundary lands, the
 * submit handler will delegate to the approved server-function and swap the
 * preview selection for the returned real ID.
 *
 * Safety guarantees:
 *  - no fetch / no Supabase call / no server-function call
 *  - no tenant-membership write / no ownership write
 *  - Startup fixtures may only spawn Startup AI; Investor fixtures may only
 *    spawn Investor AI. Domain field is locked to the template domain.
 *  - closing confirmation says: "Preview only — no real Agent was created."
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, UserCircle2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DefaultIntakeActorType, DefaultIntakeDomain } from "@/lib/default-intake";

export interface CreateRealAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorType: DefaultIntakeActorType;
  /** Domain is locked to the template's domain — cannot be changed by the user. */
  domain: DefaultIntakeDomain;
  /** Template display name, pre-filled into the form as a starting point. */
  templateName: string;
  /** Tenant this fixture belongs to. Rendered read-only. */
  tenantId: string;
}

const HUMAN_ROLES = ["Analyst", "Associate", "Partner", "Admin"] as const;
const STARTUP_AI_ROLES = [
  "Startup Analysis",
  "Startup Enrichment",
  "Startup Matching",
] as const;
const INVESTOR_AI_ROLES = [
  "Investor Mandate",
  "Investor Portfolio",
  "Investor Matching",
] as const;

export function CreateRealAgentDialog({
  open,
  onOpenChange,
  actorType,
  domain,
  templateName,
  tenantId,
}: CreateRealAgentDialogProps) {
  const [submitted, setSubmitted] = useState(false);

  // Human fields
  const [name, setName] = useState(templateName);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(HUMAN_ROLES[0]);
  const [active, setActive] = useState(true);
  const [sendInvite, setSendInvite] = useState(true);

  // AI fields
  const aiRoleOptions = domain === "startup" ? STARTUP_AI_ROLES : INVESTOR_AI_ROLES;
  const [aiRole, setAiRole] = useState<string>(aiRoleOptions[0]);
  const [capabilities, setCapabilities] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved">("pending");

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setName(templateName);
      setEmail("");
      setRole(HUMAN_ROLES[0]);
      setActive(true);
      setSendInvite(true);
      setAiRole(aiRoleOptions[0]);
      setCapabilities("");
      setApprovalStatus("pending");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateName, actorType, domain]);

  const domainLabel = domain === "startup" ? "Startup" : "Investor";
  const isHuman = actorType === "human";
  const title = isHuman
    ? "Create real Human Agent from template"
    : `Create real ${domainLabel} AI Agent from template`;

  const canSubmit = isHuman
    ? name.trim().length > 0 && email.trim().length > 0
    : name.trim().length > 0;

  const handleSubmit = () => {
    // PREVIEW ONLY — no fetch, no server function, no writes.
    // When the backend provisioning boundary is approved this handler will
    // call it and receive a real ID to swap in for the fixture selection.
    setSubmitted(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHuman ? (
              <UserCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            Template:{" "}
            <span className="font-medium text-foreground">{templateName}</span>{" "}
            <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Preview fixture
            </span>{" "}
            — not a real tenant user. Complete the fields below to describe the real Agent to be
            provisioned by the backend.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-foreground">
                  Preview only — no real Agent was created.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  When the backend user / AI provisioning boundary is approved, this form will
                  submit through it, a real tenant-bound identity will be returned, and that real
                  ID will replace the preview fixture in the ownership picker.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Backend provisioning required · Production cutover not authorized
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyField label="Tenant" value={tenantId} />
              <ReadOnlyField
                label={isHuman ? "Actor type" : "Domain (locked)"}
                value={isHuman ? "Human" : `${domainLabel} AI`}
              />
            </div>

            {isHuman ? (
              <>
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="person@company.com"
                  />
                </Field>
                <Field label="Role">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HUMAN_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <Label htmlFor="agent-active" className="text-sm">
                    Active
                  </Label>
                  <Switch id="agent-active" checked={active} onCheckedChange={setActive} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <Label htmlFor="agent-invite" className="text-sm">
                    Send invitation email
                  </Label>
                  <Switch
                    id="agent-invite"
                    checked={sendInvite}
                    onCheckedChange={setSendInvite}
                  />
                </div>
              </>
            ) : (
              <>
                <Field label="Agent name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </Field>
                <Field label={`AI role (${domainLabel})`}>
                  <Select value={aiRole} onValueChange={setAiRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiRoleOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Capabilities">
                  <Textarea
                    value={capabilities}
                    onChange={(e) => setCapabilities(e.target.value)}
                    placeholder="Enrichment, classification, matching preparation…"
                    rows={3}
                  />
                </Field>
                <Field label="Approval status">
                  <Select
                    value={approvalStatus}
                    onValueChange={(v) => setApprovalStatus(v as "pending" | "approved")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <Label htmlFor="ai-active" className="text-sm">
                    Active
                  </Label>
                  <Switch id="ai-active" checked={active} onCheckedChange={setActive} />
                </div>
                <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Domain is locked to <strong>{domainLabel}</strong>. Startup AI and Investor AI
                    remain separate; this template cannot spawn the opposite domain.
                  </span>
                </div>
              </>
            )}

            <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
              Submitting will not create a real user, tenant membership, or ownership record. The
              fixture template ID is never sent to the backend.
            </p>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                Submit (preview)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("space-y-1")}>
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
        {value}
      </div>
    </div>
  );
}
