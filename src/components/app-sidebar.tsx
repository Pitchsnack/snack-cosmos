import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ScrollText,
  ChevronLeft,
  Menu,
  X,
  Users as UsersIcon,
  ShieldCheck,
  Shield,
  LayoutDashboard,
  Rocket,
  Briefcase,
  MessagesSquare,
  FileText,
  BarChart3,
  Settings,
  Sparkles,
  Share2,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

import { UserMenu } from "@/components/user-menu";
import { WorkspaceHeader } from "@/components/workspace-header";
import { usePermissions } from "@/hooks/use-session-context";
import { usePreferences } from "@/hooks/use-preferences";
import type { Permission } from "@/lib/permissions";
import logoWhite from "@/assets/pitchsnack-white.png";
import hatWhiteIcon from "@/assets/pitchsnack-hat-white-icon.png";

type NavPath =
  | "/"
  | "/dashboard"
  | "/startups"
  | "/investors"
  | "/deals"
  | "/audit"
  | "/users"
  | "/access-management"
  | "/security"
  | "/notifications"
  | "/preferences";

type NavItem = {
  label: string;
  icon: typeof Building2;
  path: NavPath;
  exact: boolean;
  perm?: Permission;
  controlOnly?: boolean;
  // PRD 3 framework placeholders — modules not yet built
  disabled?: boolean;
};

// Role-aware nav per PRD 3 §17. Items without dedicated routes are
// rendered as disabled placeholders so each role's framework is visible.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", exact: false },
  { label: "Tenants", icon: Building2, path: "/", exact: true, perm: "tenants.read" },
  { label: "Startups", icon: Rocket, path: "/startups", exact: false, perm: "startups.read" },
  { label: "Investors", icon: Briefcase, path: "/investors", exact: false, perm: "investors.read" },
  { label: "Deals", icon: Sparkles, path: "/deals", exact: false, perm: "deals.read" },
  { label: "Communications", icon: MessagesSquare, path: "/dashboard", exact: false, disabled: true },
  { label: "Documents", icon: FileText, path: "/dashboard", exact: false, disabled: true },
  { label: "Analytics", icon: BarChart3, path: "/dashboard", exact: false, controlOnly: true, disabled: true },
  { label: "Users", icon: UsersIcon, path: "/users", exact: false, perm: "users.read" },
  { label: "Access Management", icon: ShieldCheck, path: "/access-management", exact: false, controlOnly: true },
  { label: "Notifications", icon: Bell, path: "/notifications", exact: false },
  { label: "Audit Logs", icon: ScrollText, path: "/audit", exact: false, perm: "audit.read" },
  { label: "Security", icon: Shield, path: "/security", exact: false, perm: "security.read" },
  { label: "Preferences", icon: Settings, path: "/preferences", exact: false },
];

const COLLAPSED_KEY = "sp2.sidebarCollapsed";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function SidebarBody({
  collapsed,
  onToggle,
  isMobile = false,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showLabels = !collapsed || isMobile;
  const { has, isControl } = usePermissions();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.controlOnly) return isControl;
    if (!item.perm) return true;
    return has(item.perm);
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {showLabels ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Toggle sidebar"
            title="Click the logo to expand or collapse the sidebar"
            className="flex items-center bg-transparent p-0"
          >
            <img src={logoWhite} alt="PitchSnack" className="h-9 w-auto" />
          </button>
        ) : null}
        {!isMobile && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
              collapsed && "mx-auto",
            )}
          >
            <img
              src={hatWhiteIcon}
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute h-5 w-5 select-none transition-opacity duration-100",
                collapsed ? "opacity-80" : "opacity-0",
              )}
            />
            <ChevronLeft
              className={cn(
                "absolute h-4 w-4 transition-opacity duration-100",
                collapsed ? "opacity-0" : "opacity-100",
              )}
            />
          </button>
        )}
      </div>


      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {visibleItems.map((item, idx) => {
          const isActive = !item.disabled && (item.exact
            ? pathname === item.path
            : pathname.startsWith(item.path));
          const baseClass = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            !showLabels && "justify-center px-2",
            item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-sidebar-foreground/70",
          );

          if (item.disabled) {
            return (
              <div
                key={`${item.label}-${idx}`}
                title={!showLabels ? `${item.label} (coming soon)` : "Coming soon"}
                className={baseClass}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {showLabels && (
                  <span className="flex flex-1 items-center justify-between">
                    {item.label}
                    <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">
                      Soon
                    </span>
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={`${item.label}-${idx}`}
              to={item.path}
              onClick={onNavigate}
              title={!showLabels ? item.label : undefined}
              className={baseClass}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showLabels && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <UserMenu collapsed={!showLabels} />
      </div>
    </div>
  );
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: prefs, update: updatePrefs } = usePreferences();

  // Restore sidebar state: server-stored preference wins, falls back to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefs) {
      setCollapsed(prefs.sidebarCollapsed);
      try { localStorage.setItem(COLLAPSED_KEY, prefs.sidebarCollapsed ? "1" : "0"); } catch { /* noop */ }
    } else {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    }
  }, [prefs]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      // Persist to server (best-effort; ignore failures so UI stays snappy)
      void updatePrefs({ sidebarCollapsed: next }).catch(() => {});
      return next;
    });
  }

  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="rounded-md p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="relative h-full">
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                >
                  <X className="h-4 w-4" />
                </button>
                <SidebarBody
                  collapsed={false}
                  onToggle={() => setMobileOpen(false)}
                  isMobile
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <img src={logoWhite} alt="PitchSnack" className="h-7 w-auto" />
        </header>
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "shrink-0 border-r border-sidebar-border transition-[width] duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarBody collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-10">
          <WorkspaceHeader />
          {children}
        </div>
      </main>
    </div>
  );
}
