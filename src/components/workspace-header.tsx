import { GlobalSearch } from "@/components/global-search";
import { NotificationCenter } from "@/components/notification-center";
import { useSessionContext } from "@/hooks/use-session-context";

export function WorkspaceHeader() {
  const { data } = useSessionContext();
  const ws = data?.activeWorkspace;
  const tenantName = ws?.tenantName ?? (data?.roles.includes("CONTROL") ? "Control" : "—");
  const wsType = ws?.workspaceType ?? (data?.roles.includes("CONTROL") ? "CONTROL" : "TENANT");

  return (
    <header className="sticky top-0 z-20 -mx-8 -mt-10 mb-8 flex h-14 items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {wsType}
        </div>
        <div className="truncate text-sm font-semibold text-foreground">{tenantName}</div>
      </div>
      <div className="flex items-center gap-2">
        <GlobalSearch />
        <NotificationCenter />
      </div>
    </header>
  );
}
