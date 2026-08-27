import { useState, useEffect, useRef } from "react";
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
  Globe,
  Inbox,
  Network,
  UserCircle,
  Contact as ContactIcon,
  Database,
  Bot,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

import { UserMenu } from "@/components/user-menu";
import { WorkspaceHeader } from "@/components/workspace-header";
import { RouteBreadcrumbs } from "@/components/route-breadcrumbs";
import { useSessionContext } from "@/hooks/use-session-context";
import { useEffectivePermissions } from "@/hooks/use-effective-permissions";
import { usePreferences } from "@/hooks/use-preferences";
import type { Permission } from "@/lib/permissions";
import logoWhite from "@/assets/pitchsnack-white.png";
import hatWhiteIcon from "@/assets/pitchsnack-hat-white-icon.png";

type NavPath =
  | "/"
  | "/dashboard"
  | "/startups"
  | "/my-startups"
  | "/investors"
  | "/deals"
  | "/shared-deals"
  | "/audit"
  | "/users"
  | "/access-management"
  | "/security"
  | "/notifications"
  | "/preferences"
  | "/global-startups"
  | "/global-startups/browse"
  | "/connections"
  | "/intake-queue"
  | "/my-page"
  | "/startup-activity"
  | "/contacts"
  | "/entity-control"
  | "/industry-map"
  | "/ai-agents";


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

// Startup-user menu order (PRD 3 sidebar §19). Items are reordered for users
// whose effective role set includes STARTUP_USER.
const STARTUP_MENU_ORDER = [
  "Dashboard",
  "My Profile",
  "Startup Activity",
  "My Strategy",
  "Startups Directory",
  "Industry Map",
  "My Connections",
  "Contacts",
  "Communications",
  "Documents",
  "Notifications",
  "Preferences",
];


// CONTROL sidebar grouping (navigation UX only — no route/permission changes).
const CONTROL_NAV_GROUPS: { title: string; labels: string[] }[] = [
  {
    title: "User Workflow",
    labels: [
      "Dashboard",
      "My Profile",
      "My Strategy",
      "My Connections",
      "Contacts",
      "Deals",
      "Shared Deals",
    ],
  },
  {
    title: "Control Database",
    labels: [
      "AI Agents",
      "Control Data Intelligence",
      "Global Startups",
      "Browse Global Catalogue",
      "Startups Directory",
      "Investors Directory",
      "Industry Map",
    ],
  },
  { title: "Coming Soon", labels: ["Communications", "Documents", "Analytics"] },
  {
    title: "Administration",
    labels: [
      "Default Intake Queue",
      "Tenants",
      "Users",
      "Access Management",
      "Audit Logs",
      "Security",
    ],
  },
  { title: "Account & Activity", labels: ["Notifications", "Startup Activity", "Preferences"] },
];

// Role-aware nav per PRD 3 §17. Items without dedicated routes are
// rendered as disabled placeholders so each role's framework is visible.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", exact: false },
  { label: "Tenants", icon: Building2, path: "/", exact: true, perm: "tenants.read" },
  { label: "Startups Directory", icon: Rocket, path: "/startups", exact: false, perm: "startups.read" },
  { label: "My Strategy", icon: Building2, path: "/my-startups", exact: false, perm: "startups.read" },
  { label: "Industry Map", icon: Network, path: "/industry-map", exact: false, perm: "startups.read" },


  {
    label: "AI Agents",
    icon: Bot,
    path: "/ai-agents",
    exact: false,
    perm: "global_startups.write",
  },
  {
    label: "Control Data Intelligence",
    icon: Database,
    path: "/entity-control",
    exact: false,
    perm: "global_startups.write",
  },
  {
    label: "Global Startups",
    icon: Globe,
    path: "/global-startups",
    exact: false,
    perm: "global_startups.write",
  },
  {
    label: "Browse Global Catalogue",
    icon: Globe,
    path: "/global-startups/browse",
    exact: false,
    perm: "global_startups.import",
  },
  { label: "Investors Directory", icon: Briefcase, path: "/investors", exact: false, perm: "investors.read" },
  { label: "My Connections", icon: Network, path: "/connections", exact: false },
  { label: "Contacts", icon: ContactIcon, path: "/contacts", exact: false },
  { label: "Deals", icon: Sparkles, path: "/deals", exact: false, perm: "deals.read" },

  {
    label: "Shared Deals",
    icon: Share2,
    path: "/shared-deals",
    exact: false,
    perm: "deals.share.read",
  },
  {
    label: "Default Intake Queue",
    icon: Inbox,
    path: "/intake-queue",
    exact: false,
    perm: "default_intake.read",
  },
  {
    label: "Communications",
    icon: MessagesSquare,
    path: "/dashboard",
    exact: false,
    disabled: true,
  },
  { label: "Documents", icon: FileText, path: "/dashboard", exact: false, disabled: true },
  {
    label: "Analytics",
    icon: BarChart3,
    path: "/dashboard",
    exact: false,
    controlOnly: true,
    disabled: true,
  },
  { label: "Users", icon: UsersIcon, path: "/users", exact: false, perm: "users.read" },
  {
    label: "Access Management",
    icon: ShieldCheck,
    path: "/access-management",
    exact: false,
    controlOnly: true,
  },
  { label: "Notifications", icon: Bell, path: "/notifications", exact: false },
  { label: "Audit Logs", icon: ScrollText, path: "/audit", exact: false, perm: "audit.read" },
  { label: "Security", icon: Shield, path: "/security", exact: false, perm: "security.read" },
  { label: "Startup Activity", icon: BarChart3, path: "/startup-activity", exact: false },
  { label: "My Profile", icon: UserCircle, path: "/my-page", exact: false },
  { label: "Preferences", icon: Settings, path: "/preferences", exact: false },
];

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
  const { has, isControl, isResolved, roles } = useEffectivePermissions();
  const { data: sessionData } = useSessionContext();

  // While permissions are unresolved AND we have no cached session data,
  // render every NAV_ITEM as a non-clickable skeleton so the sidebar keeps
  // its full height/order instead of collapsing to ungated items.
  const showSkeleton = !isResolved && !sessionData;

  const isStartupUser = roles.includes("STARTUP_USER");
  const useControlGroups = isControl && !showSkeleton && !isStartupUser;


  const visibleItems = (() => {
    const filtered = showSkeleton
      ? NAV_ITEMS
      : NAV_ITEMS.filter((item) => {
          if (item.controlOnly) return isControl;
          if (!item.perm) return true;
          return has(item.perm);
        });

    if (!isStartupUser || showSkeleton) return filtered;

    const orderIndex = new Map(STARTUP_MENU_ORDER.map((label, i) => [label, i]));
    return [...filtered].sort((a, b) => {
      const aIdx = orderIndex.get(a.label);
      const bIdx = orderIndex.get(b.label);
      if (aIdx === undefined && bIdx === undefined) return 0;
      if (aIdx === undefined) return 1;
      if (bIdx === undefined) return -1;
      return aIdx - bIdx;
    });
  })();

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
            aria-expanded={!collapsed}
            aria-controls="app-sidebar-nav"
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

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {(() => {
          const renderItem = (item: NavItem, idx: number, hideSoonBadge = false) => {
            const isActive =
              !item.disabled &&
              !showSkeleton &&
              (item.exact ? pathname === item.path : pathname.startsWith(item.path));
            const renderAsStatic = item.disabled || showSkeleton;
            const baseClass = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              !showLabels && "justify-center px-2",
              item.disabled &&
                "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-sidebar-foreground/70",
              showSkeleton &&
                "cursor-default opacity-50 hover:bg-transparent hover:text-sidebar-foreground/70",
            );

            if (renderAsStatic) {
              return (
                <div
                  key={`${item.label}-${idx}`}
                  title={
                    !showLabels
                      ? item.disabled
                        ? `${item.label} (coming soon)`
                        : item.label
                      : item.disabled
                        ? "Coming soon"
                        : undefined
                  }
                  aria-hidden={showSkeleton ? "true" : undefined}
                  className={baseClass}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {showLabels && (
                    <span className="flex flex-1 items-center justify-between">
                      {item.label}
                      {item.disabled && !hideSoonBadge && (
                        <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">
                          Soon
                        </span>
                      )}
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
                {showLabels && <span className="whitespace-pre">{item.label}{item.label === "Investors Directory" ? "\n" : ""}</span>}
              </Link>
            );
          };

          if (!useControlGroups) {
            return <div className="space-y-1">{visibleItems.map((it, i) => renderItem(it, i))}</div>;
          }

          const remaining = [...visibleItems];
          const groups = CONTROL_NAV_GROUPS.map((group) => {
            const items: NavItem[] = [];
            for (const label of group.labels) {
              const i = remaining.findIndex((it) => it.label === label);
              if (i !== -1) items.push(...remaining.splice(i, 1));
            }
            return { title: group.title, items };
          }).filter((g) => g.items.length > 0);

          if (remaining.length > 0) groups.push({ title: "Other", items: remaining });

          return (
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.title} className="space-y-1">
                  {showLabels && (
                    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {group.title}
                    </div>
                  )}
                  {group.items.map((it, i) => renderItem(it, i, group.title === "Coming Soon"))}
                </div>
              ))}
            </div>
          );
        })()}
      </nav>


      <div className="border-t border-sidebar-border p-2">
        <UserMenu collapsed={!showLabels} />
      </div>
    </div>
  );
}

type SidebarIntent = "auto" | "open" | "closed";
const INTENT_KEY = "sp2.sidebarIntent";

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute =
    pathname.startsWith("/access-management") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/security");

  const [intent, setIntent] = useState<SidebarIntent>("auto");
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: prefs, update: updatePrefs } = usePreferences();

  const sidebarRef = useRef<HTMLElement | null>(null);
  const lastToggleRef = useRef(0);
  const intentRef = useRef<SidebarIntent>(intent);
  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  // Restore intent: server preference (sidebarCollapsed) maps to pinned states; localStorage fallback.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(INTENT_KEY) as SidebarIntent | null;
      if (stored === "open" || stored === "closed" || stored === "auto") {
        setIntent(stored);
        return;
      }
    } catch {
      /* noop */
    }
    if (prefs) setIntent(prefs.sidebarCollapsed ? "closed" : "auto");
  }, [prefs]);

  const persistIntent = (next: SidebarIntent) => {
    setIntent(next);
    lastToggleRef.current = Date.now();
    try {
      localStorage.setItem(INTENT_KEY, next);
    } catch {
      /* noop */
    }
    if (next !== "auto") {
      void updatePrefs({ sidebarCollapsed: next === "closed" }).catch(() => {});
    }
  };

  const collapsedByIntent = intent === "open" ? false : intent === "closed" ? true : autoCollapsed;
  const effectiveCollapsed = !isMobile && !isAdminRoute ? collapsedByIntent : false;

  const toggle = () => persistIntent(effectiveCollapsed ? "open" : "closed");

  // Re-expand on route change for 'auto' users; close mobile drawer.
  useEffect(() => {
    setAutoCollapsed(false);
    setMobileOpen(false);
  }, [pathname]);

  // Single capture-phase click listener for auto-collapse.
  useEffect(() => {
    if (isMobile || isAdminRoute) return;
    const onClickCapture = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-app-sidebar]")) return;
      if (target.closest('[role="dialog"], [role="alertdialog"]')) return;
      if (target.closest("[data-keep-sidebar]")) return;
      if (window.getSelection()?.toString()) return;
      if (intentRef.current !== "auto") return;
      const sidebarEl = sidebarRef.current;
      if (sidebarEl && document.activeElement && sidebarEl.contains(document.activeElement)) return;
      const now = Date.now();
      if (now - lastToggleRef.current < 250) return;
      lastToggleRef.current = now;
      setAutoCollapsed(true);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isMobile, isAdminRoute]);

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
        <main className="flex-1 overflow-y-auto p-4">
          <RouteBreadcrumbs className="mb-3" />
          {children}
        </main>
      </div>
    );
  }

  return (
    <div
      className="grid h-screen w-full overflow-hidden bg-background transition-[grid-template-columns] duration-300 motion-reduce:transition-none"
      style={
        {
          gridTemplateColumns: "var(--sidebar-width) 1fr",
          "--sidebar-width": effectiveCollapsed ? "4rem" : "16rem",
        } as React.CSSProperties
      }
    >
      <aside
        ref={sidebarRef}
        id="app-sidebar-nav"
        data-app-sidebar
        aria-label="Primary"
        className={cn(
          "h-screen overflow-hidden border-r border-sidebar-border bg-sidebar shadow-lg",
          "transition-[width] duration-300 motion-reduce:transition-none",
          effectiveCollapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarBody collapsed={effectiveCollapsed} onToggle={toggle} />
      </aside>

      <main className="h-screen min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-8 py-10">
          <WorkspaceHeader />
          <RouteBreadcrumbs className="sticky top-14 z-10 -mx-8 mb-4 border-b border-border/60 bg-background/95 px-8 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70" />
          {children}
        </div>
      </main>
    </div>
  );
}
