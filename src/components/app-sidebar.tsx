import { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ScrollText, ChevronLeft, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import logoWhite from "@/assets/pitchsnack-white.png";
import hatWhiteIcon from "@/assets/pitchsnack-hat-white-icon.png";

const NAV_ITEMS = [
  { label: "Tenants", icon: Building2, path: "/" as const, exact: true },
  { label: "Audit Logs", icon: ScrollText, path: "/audit" as const, exact: false },
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

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="relative flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {showLabels ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Toggle sidebar"
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

      {showLabels && (
        <div className="border-b border-sidebar-border p-3">
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Workspace
          </div>
          <WorkspaceSwitcher />
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.path
            : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={!showLabels ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                !showLabels && "justify-center px-2",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showLabels && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {showLabels ? (
          <div className="px-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
            SnackPortal2 · Control Plane
          </div>
        ) : (
          <div className="text-center text-[10px] text-sidebar-foreground/40">S2</div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
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
        <div className="mx-auto max-w-7xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
