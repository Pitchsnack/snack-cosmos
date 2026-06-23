import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useViewMode } from "@/hooks/use-view-mode";
import { useSessionContext } from "@/hooks/use-session-context";
import {
  VIEW_ROLES,
  VIEW_ROLE_LABELS,
  isTenantScopedViewRole,
  type ViewRole,
} from "@/context/view-mode-context";

const NO_TENANT = "__none__";

/**
 * PRD 7.1 — Control-only "View as" preview switcher.
 *
 * Renders ONLY when the session is resolved AND the real role is CONTROL.
 * Tenant selection is display-only — it does NOT call switchWorkspace and
 * does NOT change API/DB scope.
 */
export function ViewAsSwitcher() {
  const {
    canUseSwitcher,
    requestedViewRole,
    requestedViewTenantId,
    isPreviewMode,
    setRequestedViewRole,
    setRequestedViewTenantId,
    resetPreview,
  } = useViewMode();
  const { data } = useSessionContext();

  if (!canUseSwitcher) return null;

  const tenants = data?.tenants ?? [];
  const showTenant = isTenantScopedViewRole(requestedViewRole);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isPreviewMode ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5"
          data-keep-sidebar
          aria-label="View as"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {isPreviewMode ? VIEW_ROLE_LABELS[requestedViewRole] : "View as"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end" data-keep-sidebar>
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold leading-none">View as</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preview the sidebar for another role. Presentation only — your
              real Control permissions are unchanged.
            </p>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select
              value={requestedViewRole}
              onValueChange={(v) => setRequestedViewRole(v as ViewRole)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {VIEW_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showTenant && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant (display only)</Label>
              <Select
                value={requestedViewTenantId ?? NO_TENANT}
                onValueChange={(v) =>
                  setRequestedViewTenantId(v === NO_TENANT ? null : v)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TENANT}>No tenant</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.tenantId} value={t.tenantId}>
                      {t.tenantName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Does not change workspace, queries, or permissions.
              </p>
            </div>
          )}

          {isPreviewMode && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-center text-xs"
                onClick={() => resetPreview()}
              >
                Exit preview
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
