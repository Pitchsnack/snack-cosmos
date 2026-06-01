import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { recordLogout } from "@/lib/auth.functions";
import { useSessionContext } from "@/hooks/use-session-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/permissions";

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSessionContext();
  const onLogout = useServerFn(recordLogout);

  const u = data?.user;
  const initials =
    (u?.firstName?.[0] ?? "") + (u?.lastName?.[0] ?? "") ||
    (u?.email?.[0]?.toUpperCase() ?? "?");
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Signed in";
  const roleLabel = data?.roles[0] ? ROLE_LABELS[data.roles[0]] : "—";

  async function signOut() {
    try { await onLogout(); } catch { /* best effort */ }
    await supabase.auth.signOut();
    qc.clear();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
            {initials.slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">{roleLabel}</div>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{u?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          {roleLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
