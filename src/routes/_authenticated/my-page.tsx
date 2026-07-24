import { createFileRoute } from "@tanstack/react-router";
import {
  Mail,
  MapPin,
  Calendar,
  Building2,
  Rocket,
  LineChart,
  Handshake,
  Bell,
  Pencil,
  Key,
  Lock,
} from "lucide-react";

import { useSessionContext } from "@/hooks/use-session-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const { data: session } = useSessionContext();
  const user = session?.user;

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";
  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")) ||
    (user?.email?.[0]?.toUpperCase() ?? "?");
  const roleLabel = session?.roles[0] ? ROLE_LABELS[session.roles[0]] : "Startup User";
  const company = session?.activeWorkspace.tenantName ?? "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, preferences and account settings.
        </p>
      </div>

      {/* Profile hero */}
      <Card className="border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                {initials.slice(0, 2).toUpperCase()}
              </div>
              <button
                type="button"
                aria-label="Edit avatar"
                className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-card hover:opacity-90"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
              <p className="text-sm font-medium text-primary">{roleLabel}</p>
              <div className="flex flex-col gap-1 pt-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {user?.email ?? "—"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  San Francisco, CA, USA
                </span>
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined May 12, 2024
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-primary/5 p-5 lg:min-w-[280px]">
            <div className="text-xs font-medium text-muted-foreground">Current Workspace</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold">{company}</div>
                <div className="text-xs text-muted-foreground">Startup Portfolio</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Rocket} label="Startups" value="8" hint="Following" tone="primary" />
        <StatCard icon={LineChart} label="Introductions" value="5" hint="Active" tone="success" />
        <StatCard icon={Handshake} label="Tasks" value="12" hint="Pending" tone="accent" />
        <StatCard icon={Bell} label="Notifications" value="3" hint="Unread" tone="info" />
      </div>

      {/* Two-column: personal + preferences */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Personal Information">
          <InfoRow label="Full Name" value={name} />
          <InfoRow label="Email" value={user?.email ?? "—"} />
          <InfoRow label="Phone" value="+1 (415) 555-0123" />
          <InfoRow label="Timezone" value="(GMT-08:00) Pacific Time (US & Canada)" />
          <InfoRow label="Location" value="San Francisco, CA, USA" />
          <InfoRow
            label="Bio"
            value="Founder & CEO of AppMan. Building the future of workforce management."
          />
        </SectionCard>

        <SectionCard title="Preferences">
          <InfoRow label="Email Notifications" value="Enabled" />
          <InfoRow label="Task Reminders" value="Daily" />
          <InfoRow label="Deal Alerts" value="Enabled" />
          <InfoRow label="Introduction Alerts" value="Enabled" />
          <InfoRow label="Language" value="English" />
          <InfoRow label="Theme" value="Light" />
        </SectionCard>
      </div>

      {/* Account & Security */}
      <Card className="flex flex-col gap-4 border-border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold">Account & Security</div>
            <div className="text-sm text-muted-foreground">
              Manage your password and security preferences.
            </div>
          </div>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto">
          <Key className="h-4 w-4" />
          Change Password
        </Button>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "accent" | "success" | "info";
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
  };
  const hintTone: Record<string, string> = {
    primary: "text-muted-foreground",
    accent: "text-accent-foreground/80",
    success: "text-success",
    info: "text-info",
  };

  return (
    <Card className="flex items-center gap-4 border-border bg-card p-5 shadow-card">
      <div className={cn("grid h-12 w-12 place-items-center rounded-full", toneClasses[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold leading-none">{value}</div>
        <div className={cn("mt-1 text-xs", hintTone[tone])}>{hint}</div>
      </div>
    </Card>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 first:pt-0 last:pb-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="col-span-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
