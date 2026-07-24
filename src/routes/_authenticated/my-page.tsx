import { createFileRoute } from "@tanstack/react-router";
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Pencil,
  Rocket,
  TrendingUp,
  ClipboardList,
  Bell,
  Lock,
} from "lucide-react";

import { useSessionContext } from "@/hooks/use-session-context";
import { usePreferences, useNotificationPreferences } from "@/hooks/use-preferences";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/my-page")({
  head: () => ({
    meta: [
      { title: "My Page — SnackPortal2" },
      {
        name: "description",
        content: "Manage your profile, preferences and account settings.",
      },
    ],
  }),
  component: MyPage,
});

function MyPage() {
  const { data: session, isLoading } = useSessionContext();
  const { data: prefs } = usePreferences();
  const { data: notif } = useNotificationPreferences();
  const user = session?.user;

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    (user?.email?.[0]?.toUpperCase() ?? "?");
  const roleLabel = session?.roles[0] ? ROLE_LABELS[session.roles[0]] : "Startup User";
  const company =
    session?.activeWorkspace.tenantName ??
    session?.tenants[0]?.tenantName ??
    (session?.roles.includes("CONTROL") ? "Control" : "—");
  const workspaceTypeLabel =
    session?.activeWorkspace.workspaceType === "CONTROL"
      ? "Control Platform"
      : "Startup Portfolio";


  return (
    <div className="-mx-8 -mt-10 -mb-10 min-h-screen bg-white px-8 pt-10 pb-10">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Page</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your profile, preferences and account settings.
          </p>
        </div>

        {/* Profile hero card */}
        <Card className="overflow-hidden border border-border bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <Avatar className="h-24 w-24 rounded-full bg-muted">
                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                  {initials.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                aria-label="Edit profile photo"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
              <p className="text-sm font-medium text-purple-600">{roleLabel}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user?.email ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  San Francisco, CA, USA
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined May 12, 2024
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <div className="flex items-center gap-4 rounded-xl bg-purple-50 px-5 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-purple-100 text-purple-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-purple-600/80">Current Workspace</div>
                  <div className="text-sm font-semibold text-purple-900">{company}</div>
                  <div className="text-xs text-purple-600/70">Startup Portfolio</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Rocket}
            label="Startups"
            value={8}
            sublabel="Following"
            tone="purple"
          />
          <StatCard
            icon={TrendingUp}
            label="Introductions"
            value={5}
            sublabel="Active"
            tone="green"
          />
          <StatCard
            icon={ClipboardList}
            label="Tasks"
            value={12}
            sublabel="Pending"
            tone="orange"
          />
          <StatCard
            icon={Bell}
            label="Notifications"
            value={3}
            sublabel="Unread"
            tone="blue"
          />
        </div>

        {/* Personal info + preferences grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Personal Information */}
          <Card className="border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Personal Information</h3>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
            <div className="px-5 py-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              ) : (
                <div className="divide-y divide-border">
                  <InfoRow label="Full Name" value={name} />
                  <InfoRow label="Email" value={user?.email ?? "—"} />
                  <InfoRow label="Phone" value="+1 (415) 555-0123" />
                  <InfoRow label="Timezone" value="(GMT-08:00) Pacific Time (US & Canada)" />
                  <InfoRow label="Location" value="San Francisco, CA, USA" />
                  <InfoRow label="Bio" value="Founder & CEO of AppMan. Building the future of workforce management." />
                </div>
              )}
            </div>
          </Card>

          {/* Preferences */}
          <Card className="border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Preferences</h3>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
            <div className="px-5 py-4">
              <div className="divide-y divide-border">
                <InfoRow
                  label="Email Notifications"
                  value={notif?.emailEnabled ?? true ? "Enabled" : "Disabled"}
                />
                <InfoRow label="Task Reminders" value="Daily" />
                <InfoRow
                  label="Deal Alerts"
                  value={notif?.systemEnabled ?? true ? "Enabled" : "Disabled"}
                />
                <InfoRow
                  label="Introduction Alerts"
                  value={notif?.inAppEnabled ?? true ? "Enabled" : "Disabled"}
                />
                <InfoRow label="Language" value="English" />
                <InfoRow
                  label="Theme"
                  value={prefs?.theme ? prefs.theme.charAt(0).toUpperCase() + prefs.theme.slice(1) : "Light"}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Account & Security */}
        <Card className="border border-border bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Account & Security</h3>
                <p className="text-xs text-muted-foreground">Manage your password and security preferences.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Change Password
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 first:pt-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel: string;
  tone: "purple" | "green" | "orange" | "blue";
}) {
  const toneClasses = {
    purple: {
      icon: "bg-purple-100 text-purple-600",
      sublabel: "text-purple-600",
    },
    green: {
      icon: "bg-green-100 text-green-600",
      sublabel: "text-green-600",
    },
    orange: {
      icon: "bg-orange-100 text-orange-600",
      sublabel: "text-orange-600",
    },
    blue: {
      icon: "bg-blue-100 text-blue-600",
      sublabel: "text-blue-600",
    },
  };

  return (
    <Card className="flex items-center gap-4 border border-border bg-white p-4 shadow-sm">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full", toneClasses[tone].icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
        <div className={cn("text-xs font-medium", toneClasses[tone].sublabel)}>{sublabel}</div>
      </div>
    </Card>
  );
}
