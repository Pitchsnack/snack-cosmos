import { useMemo } from "react";
import { Link, useRouterState, type AnyRouteMatch } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSessionContext } from "@/hooks/use-session-context";

/**
 * Maps route path templates to human-readable breadcrumb labels.
 * Path templates are derived from route IDs by stripping the
 * authenticated layout prefix and normalising index slashes.
 */
const PATH_LABELS: Record<string, string> = {
  "/": "Tenants",
  "/dashboard": "Dashboard",
  "/startups": "Startups",
  "/startups/new": "New Startup",
  "/startups/$id": "Startup",
  "/startups/$id/edit": "Edit Startup",
  "/my-startups": "My Startups",
  "/my-startups/new": "Add My Startup",
  "/my-startups/$id": "My Startup",
  "/my-startups/$id/edit": "Edit My Startup",

  "/investors": "Investors",
  "/investors/new": "New Investor",
  "/investors/$id": "Investor",
  "/investors/$id/edit": "Edit Investor",
  "/deals": "Deals",
  "/deals/new": "New Deal",
  "/deals/$id": "Deal",
  "/shared-deals": "Shared Deals",
  "/shared-deals/$id": "Shared Deal",
  "/contacts": "Contacts",
  "/contacts/quick-add": "Add Name Card",
  "/connections": "My Connections",
  "/global-startups": "Global Startups",
  "/global-startups/$id": "Global Startup",
  "/global-startups/browse": "Browse Catalogue",
  "/intake-queue": "Default Intake Queue",
  "/users": "Users",
  "/access-management": "Access Management",
  "/audit": "Audit Logs",
  "/security": "Security",
  "/notifications": "Notifications",
  "/preferences": "Preferences",
  "/my-page": "My Profile",
  "/startup-activity": "Startup Activity",
  "/entity-control": "Control Data Intelligence",
};

const HOME_ROUTE = "/dashboard";
const HIDDEN_ROUTE_IDS = new Set(["/", "/_authenticated", "__root__"]);

function getPathTemplate(routeId: string) {
  return routeId.replace(/^\/_authenticated/, "").replace(/\/$/, "") || "/";
}

function formatLabelFromTemplate(pathTemplate: string) {
  const last = pathTemplate.split("/").pop() ?? "";
  return last
    .replace(/-/g, " ")
    .replace(/^\$/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Page";
}

function resolveLabel(pathTemplate: string) {
  return PATH_LABELS[pathTemplate] ?? formatLabelFromTemplate(pathTemplate);
}

export function RouteBreadcrumbs({ className }: { className?: string }) {
  const matches = useRouterState({ select: (s) => s.matches as AnyRouteMatch[] });
  // Active workspace comes from the approved session/workspace context only —
  // never inferred from the current route or page content.
  const { data: session } = useSessionContext();
  const isControl = (session?.roles ?? []).includes("CONTROL");
  const workspaceLabel =
    session?.activeWorkspace.tenantName ?? (isControl ? "Control" : null);

  const items = useMemo(() => {
    // Deduplicate by path template, keeping the deepest (leaf) match for each
    // template so layout routes and their index leaves do not produce
    // duplicate crumbs. The leaf is always the last match in the array.
    const byTemplate = new Map<string, AnyRouteMatch>();
    for (const m of matches) {
      const pathTemplate = getPathTemplate(m.routeId);
      byTemplate.set(pathTemplate, m);
    }
    const unique = Array.from(byTemplate.values());

    return unique
      .filter((m) => !HIDDEN_ROUTE_IDS.has(m.routeId))
      .map((m) => {
        const pathTemplate = getPathTemplate(m.routeId);
        return {
          label: resolveLabel(pathTemplate),
          to: pathTemplate,
          params: (m.params ?? {}) as Record<string, string>,
        };
      });
  }, [matches]);

  if (items.length === 0) return null;

  const firstPathTemplate = items[0]?.to;
  const isHomeRoute =
    firstPathTemplate === HOME_ROUTE || firstPathTemplate === "/";
  const showHome = !isHomeRoute;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {workspaceLabel && (
          <li className="inline-flex items-center gap-1.5">
            <span
              className="max-w-[180px] truncate font-medium text-foreground"
              title={`Active workspace: ${workspaceLabel}`}
            >
              {workspaceLabel}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
          </li>
        )}
        {showHome && (
          <li className="inline-flex items-center gap-1.5">
            <Link
              to={HOME_ROUTE}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.to}-${index}`}
              className="inline-flex items-center gap-1.5"
            >
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <>
                  <Link
                    to={item.to as never}
                    params={item.params as never}
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
