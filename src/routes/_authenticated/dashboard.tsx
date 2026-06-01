import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Users as UsersIcon,
  Rocket,
  Briefcase,
  Bell,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessionContext, usePermissions } from "@/hooks/use-session-context";
import { getWorkspaceMetrics } from "@/lib/workspace.functions";
import type { AppRole } from "@/lib/permissions";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SnackPortal2" },
      { name: "description", content: "Your SnackPortal2 workspace dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: session } = useSessionContext();
  const { isControl } = usePermissions();
  const fn = useServerFn(getWorkspaceMetrics);
  const { data: metrics } = useQuery({
    queryKey: ["workspace-metrics"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const primaryRole = (session?.roles[0] ?? "TENANT_AGENT") as AppRole;
  const tenantLabel = session?.activeWorkspace.tenantName ?? (isControl ? "Control" : "Workspace");

  const widgets = pickWidgets(primaryRole, isControl);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenantLabel} · {primaryRole.replace(/_/g, " ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((w) => (
          <Metric
            key={w.key}
            label={w.label}
            icon={w.icon}
            value={readMetric(w.key, metrics)}
            note={w.note}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent notifications
            </h2>
            <Link to="/notifications" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {metrics?.recentNotifications.length ? (
            <ul className="space-y-2">
              {metrics.recentNotifications.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  {!n.isRead && <Badge variant="outline">New</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine icon={Bell} text="No notifications yet." />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent security events
          </h2>
          {metrics?.recentSecurityEvents.length ? (
            <ul className="space-y-2">
              {metrics.recentSecurityEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{e.eventType}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine icon={ShieldAlert} text="No security events visible." />
          )}
        </Card>
      </div>
    </div>
  );
}

type MetricKey =
  | "tenants"
  | "users"
  | "startups"
  | "investors"
  | "unreadNotifications";

function readMetric(key: MetricKey, m: Awaited<ReturnType<typeof getWorkspaceMetrics>> | undefined) {
  if (!m) return "—";
  const v = m[key];
  if (v === null || v === undefined) return "—";
  return String(v);
}

function pickWidgets(role: AppRole, isControl: boolean) {
  const base = [
    { key: "unreadNotifications" as MetricKey, label: "Unread Notifications", icon: Bell, note: "In-app" },
  ];

  if (isControl) {
    return [
      { key: "tenants" as MetricKey, label: "Total Tenants", icon: Building2, note: "Platform" },
      { key: "users" as MetricKey, label: "Total Users", icon: UsersIcon, note: "Platform" },
      { key: "startups" as MetricKey, label: "Startups", icon: Rocket, note: "Module pending" },
      { key: "investors" as MetricKey, label: "Investors", icon: Briefcase, note: "Module pending" },
    ];
  }

  switch (role) {
    case "MASTER_AGENT":
    case "MASTER_AGENT_AI":
      return [
        { key: "tenants" as MetricKey, label: "Assigned Tenants", icon: Building2, note: "Visible" },
        { key: "startups" as MetricKey, label: "Shared Deals", icon: Briefcase, note: "Module pending" },
        ...base,
      ];
    case "TENANT_ADMIN":
      return [
        { key: "users" as MetricKey, label: "Workspace Users", icon: UsersIcon, note: "Tenant" },
        { key: "startups" as MetricKey, label: "Startups", icon: Rocket, note: "Module pending" },
        { key: "investors" as MetricKey, label: "Investors", icon: Briefcase, note: "Module pending" },
        ...base,
      ];
    case "STARTUP_USER":
      return [
        { key: "startups" as MetricKey, label: "Profile Status", icon: Rocket, note: "Module pending" },
        ...base,
      ];
    case "INVESTOR_USER":
      return [
        { key: "investors" as MetricKey, label: "Recommendations", icon: Briefcase, note: "Module pending" },
        ...base,
      ];
    default:
      return [
        { key: "startups" as MetricKey, label: "Startups", icon: Rocket, note: "Module pending" },
        { key: "investors" as MetricKey, label: "Investors", icon: Briefcase, note: "Module pending" },
        ...base,
      ];
  }
}

function Metric({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Bell;
  note?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {note && <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>}
    </Card>
  );
}

function EmptyLine({ icon: Icon, text }: { icon: typeof Bell; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-6 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      {text}
    </div>
  );
}
