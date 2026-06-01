import { GlobalSearch } from "@/components/global-search";
import { NotificationCenter } from "@/components/notification-center";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useSessionContext } from "@/hooks/use-session-context";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  CONTROL: "Control",
  MASTER_AGENT: "Master Agent",
  MASTER_AGENT_AI: "Master Agent AI",
  TENANT_ADMIN: "Tenant Admin",
  TENANT_AGENT: "Tenant Agent",
  TENANT_AGENT_AI: "Tenant Agent AI",
  STARTUP_USER: "Startup User",
  STARTUP_USER_AI: "Startup AI",
  INVESTOR_USER: "Investor User",
  INVESTOR_USER_AI: "Investor AI",
};

export function WorkspaceHeader() {
  const { data } = useSessionContext();
  const ws = data?.activeWorkspace;
  const isControl = (data?.roles ?? []).includes("CONTROL");
  const tenantName = ws?.tenantName ?? (isControl ? "Control" : "—");
  const wsType = ws?.workspaceType ?? (isControl ? "CONTROL" : "TENANT");
  const primaryRole = data?.roles[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : "—";

  return (
    <header className="sticky top-0 z-20 -mx-8 -mt-10 mb-8 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex min-w-0 items-center gap-3">
        <WorkspaceSwitcher />
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight text-foreground">
              {tenantName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
              <span className="truncate">{roleLabel}</span>
              <span className="hidden md:inline">·</span>
              <Badge
                variant="outline"
                className="hidden h-4 px-1.5 text-[9px] font-medium uppercase tracking-wider md:inline-flex"
              >
                {wsType}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <GlobalSearch />
        <NotificationCenter />
      </div>
    </header>
  );
}
