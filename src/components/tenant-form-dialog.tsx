import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  generateUniqueTenantCode,
  logAudit,
  slugifyTenantName,
  TENANT_STATUSES,
  type TenantStatus,
} from "@/lib/tenant-utils";

export interface TenantRow {
  id: string;
  tenant_code: string;
  tenant_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: TenantRow | null;
  onSaved: () => void;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </label>
  );
}

export function TenantFormDialog({ open, onOpenChange, tenant, onSaved }: Props) {
  const isEdit = !!tenant;
  const [name, setName] = useState("");
  const [status, setStatus] = useState<TenantStatus>("Draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tenant?.tenant_name ?? "");
      setStatus((tenant?.status as TenantStatus) ?? "Draft");
    }
  }, [open, tenant]);

  const previewCode = isEdit
    ? tenant!.tenant_code
    : slugifyTenantName(name) || "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tenant name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && tenant) {
        const { error } = await supabase
          .from("tenants")
          .update({ tenant_name: name.trim(), status })
          .eq("id", tenant.id);
        if (error) throw error;
        await logAudit({
          tenantId: tenant.id,
          entityType: "tenant",
          entityId: tenant.id,
          action: "UPDATE",
          oldValue: { tenant_name: tenant.tenant_name, status: tenant.status },
          newValue: { tenant_name: name.trim(), status },
        });
        toast.success("Tenant updated");
      } else {
        const code = await generateUniqueTenantCode(name);
        const { data, error } = await supabase
          .from("tenants")
          .insert({ tenant_name: name.trim(), tenant_code: code, status })
          .select()
          .single();
        if (error) throw error;
        await logAudit({
          tenantId: data.id,
          entityType: "tenant",
          entityId: data.id,
          action: "CREATE",
          newValue: data,
        });
        toast.success(`Tenant created as ${code}`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save tenant";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit tenant" : "New tenant"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update tenant details. The tenant code is immutable."
                : "Tenant codes are auto-generated from the name."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-5">
            <div className="grid gap-2">
              <FieldLabel htmlFor="tenant-name">Tenant name</FieldLabel>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ABC Ventures"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <FieldLabel>Tenant code</FieldLabel>
              <div className="rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-sm text-muted-foreground">
                {previewCode}
              </div>
            </div>

            <div className="grid gap-2">
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={(v) => setStatus(v as TenantStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
