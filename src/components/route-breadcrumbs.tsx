import { useMemo } from "react";
import { Link, useRouterState, type AnyRouteMatch } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

import {useTranslation} from "@/i18n/language";
import { cn } from "@/lib/utils";
import { useSessionContext } from "@/hooks/use-session-context";
import { useIsMarketplace, usePersona } from "@/hooks/use-marketplace";

/**
 * Maps route path templates to human-readable breadcrumb labels.
 * Path templates are derived from route IDs by stripping the
 * authenticated layout prefix and normalising index slashes.
 */
const PATH_LABELS: Record<string, string> = {
  "/": "Tenants",
  "/dashboard": "Dashboard",
  "/startups": "Startups Directory\n",
  "/startups/new": "New Startup",
  "/startups/sector-images": "Sector images",
  "/investors/investor-images": "Investor images",
  "/startups/$id": "Startup",
  "/startups/$id/edit": "Edit Startup",
  "/my-startups": "My Contact",
  "/my-startups/new": "Add My Startup",
  "/my-startups/$id": "My Startup",
  "/my-startups/$id/edit": "Edit My Startup",

  "/investors": "Investors Directory",
  "/advisors": "Advisors Directory",
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
  "/admin/plans": "Plans",
  "/admin/analytics": "Analytics",
  "/admin/messages": "Messages",
  "/admin/access-codes": "Access codes",
  "/access-management": "Access Management",
  "/audit": "Audit Logs",
  "/security": "Security",
  "/notifications": "Notifications",
  "/preferences": "Preferences",
  "/my-page": "My Profile",
  "/my-verification": "Company verification report",
  "/marketplace/browse": "Browse listings",
  "/marketplace/favourites": "My watchlist",
  "/marketplace/invitations": "NDA Invitations",
  "/marketplace/advisors": "Browse advisors",
  "/marketplace/pipeline": "Pipeline",
  "/marketplace/pipeline/invitations": "NDA Invitations",
  "/marketplace/pipeline/all-deals": "All deals",
  "/marketplace/pipeline/watchlist": "Deal watchlist",
  "/marketplace/pipeline/status": "Deal status",
  "/marketplace/pipeline/history": "History",
  "/marketplace/pipeline/reports": "Reports",
  "/advisor/pipeline": "My Pipeline",
  "/advisor/messages": "Messages",
  "/advisor/contacts": "Contacts",

  "/startup-activity": "Startup Activity",
  "/ai-agents": "AI Agents",
  "/entity-control": "Control Data Intelligence",
  "/my-startups/setup/$id": "Set up your business",
  "/buyer/company/$id/setup": "Set up your investor profile",
  "/advisor/company/$id/setup": "Set up your firm profile",
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

export function RouteBreadcrumbs({ className, placement }: { className?: string; placement?: "row" | "bar" }) {
  const {language,t}=useTranslation();
  const pipelineTh:Record<string,string>={Pipeline:"ไปป์ไลน์","NDA Invitations":"คำเชิญ NDA","All deals":"ดีลทั้งหมด","Deal watchlist":"ดีลที่ติดตาม","Deal status":"สถานะดีล",History:"ประวัติ",Reports:"รายงาน"};
  const crumb=(label:string)=>language==="th" ? (label === "Pipeline" ? t(label) : pipelineTh[label]??t(label)) : label;
  const matches = useRouterState({ select: (s) => s.matches as AnyRouteMatch[] });
  const isMarketplace = useIsMarketplace();
  const { persona } = usePersona();
  // Active workspace comes from the approved session/workspace context only —
  // never inferred from the current route or page content.
  const { data: session } = useSessionContext();
  const isControl = (session?.roles ?? []).includes("CONTROL");
  const workspaceLabel =
    matches.some((m) => getPathTemplate(m.routeId) === "/admin/messages") ? "Control" : session?.activeWorkspace.tenantName ?? (isControl ? "Control" : null);

  const items = useMemo(() => {
    if (isMarketplace) {
      const area = {
        label: persona === "seller" ? "Seller" : persona === "advisor" ? "Advisor" : "Buyer",
        to: "/marketplace",
        params: {} as Record<string, string>,
      };
      const pages = new Map<string, AnyRouteMatch>();
      for (const match of matches) {
        const path = getPathTemplate(match.routeId);
        if (!HIDDEN_ROUTE_IDS.has(match.routeId) && path !== "/marketplace") {
          pages.set(path, match);
        }
      }
      return [area, ...Array.from(pages, ([path, match]) => ({
        label: path === "/my-startups" ? "My Company"
          : path === "/my-startups/new" ? "Add My Business"
          : path === "/marketplace/my-contact" ? "Contacts"
          : path === "/marketplace/my-company" ? "My Company"
          : path === "/marketplace/my-company/edit" ? "Edit profile"
          : path === "/marketplace/messages" ? "Messages"
          : path === "/marketplace/browse" && persona === "advisor" ? "Browse marketplace"
          : path === "/marketplace/browse" && persona === "seller" ? "Browse investors"
          : path === "/my-financials" ? "My Financials"
          : path === "/my-valuation" ? "Company Valuation"
          : path === "/my-risk" ? "Company Risk"
          : path === "/my-reports" ? "Tools › My reports"
          : path === "/my-reports/buyer/$pipelineId" ? "My Pipeline › Buyer reports"
          : resolveLabel(path),
        to: path,
        params: (match.params ?? {}) as Record<string, string>,
      }))];
    }

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
  }, [isMarketplace, matches, persona]);

  if (items.length === 0) return null;
  // Admin keeps the row under the header; everyone else gets it inside the grey bar.
  if (placement === "row" && !isControl) return null;
  if (placement === "bar" && isControl) return null;
  const inBar = placement === "bar";

  const firstPathTemplate = items[0]?.to;
  const isHomeRoute =
    firstPathTemplate === HOME_ROUTE || firstPathTemplate === "/";
  const showHome = !isMarketplace && !isHomeRoute;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className={cn("flex items-center gap-1.5 text-muted-foreground", inBar ? "min-w-0 flex-nowrap" : "flex-wrap")}>
        {isMarketplace ? (
          isControl && (
            <li className="inline-flex items-center gap-1.5">
              <Link to={HOME_ROUTE} className="font-medium text-foreground transition-colors hover:text-foreground/70">
                Control
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            </li>
          )
        ) : isControl && workspaceLabel && (
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
              <span className="hidden sm:inline">{items.some(i => i.to === "/admin/plans" || i.to === "/admin/access-codes" || i.to === "/admin/analytics") ? "Admin" : "Home"}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.to}-${index}`}
              title={inBar ? item.label.trim() : undefined}
              className={cn(
                "inline-flex items-center gap-1.5",
                inBar && "min-w-0",
                inBar && !isLast && "hidden shrink sm:inline-flex",
                inBar && index > 0 && !isLast && "max-w-[9rem]",
                inBar && isLast && "shrink",
              )}
            >
              {isLast ? (
                <span
                  aria-current="page"
                  className={cn("font-medium text-foreground", inBar && "min-w-0 truncate")}
                >
                  <span className={inBar ? "truncate" : "whitespace-pre"}>{crumb(item.label)}</span>
                </span>
              ) : (
                <>
                  <Link
                    to={item.to as never}
                    params={item.params as never}
                    className={cn("transition-colors hover:text-foreground", inBar && "min-w-0 truncate")}
                  >
                    <span className={inBar ? "truncate" : "whitespace-pre"}>{crumb(item.label)}</span>
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
