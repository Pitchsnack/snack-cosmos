import { createFileRoute } from "@tanstack/react-router";
import {
  User,
  Settings,
  Shield,
  Clock,
  ChevronDown,
  Users,
  Inbox,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Bell,
  Globe,
  Eye,
  Key,
  Link2,
  Smartphone,
  FileText,
  Heart,
  UserPlus,
} from "lucide-react";

import { useSessionContext } from "@/hooks/use-session-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/my-page")({
  head: () => ({
    meta: [
      { title: "My Page — SnackPortal2" },
      {
        name: "description",
        content: "Manage your personal information, preferences, and activity.",
      },
    ],
  }),
  component: MyPage,
});

function MyPage() {
  const { data: session, isLoading } = useSessionContext();
  const user = session?.user;

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    (user?.email?.[0]?.toUpperCase() ?? "?");
  const roleLabel = session?.roles[0] ? ROLE_LABELS[session.roles[0]] : "Startup User";
  const company = session?.activeWorkspace.tenantName ?? "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information, preferences, and activity.
        </p>
      </div>

      {/* Profile hero card */}
      <Card className="overflow-hidden border-border bg-card shadow-card">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
              {initials.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
              <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                {roleLabel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {company}
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
        </div>
      </Card>

      {/* Circular summary indicators */}
      <div className="flex flex-wrap items-center gap-6">
        <CircleSummary
          icon={Users}
          value={24}
          label="Total Connections"
          tone="primary"
        />
        <CircleSummary
          icon={Inbox}
          value={5}
          label="Requests"
          tone="accent"
        />
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" defaultValue={[]} className="space-y-4">
        <AccordionItem value="personal" className="rounded-xl border border-border bg-card shadow-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:rounded-t-xl [&[data-state=open]]:bg-muted/20">
            <div className="flex items-center gap-3 text-left">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Personal Information</div>
                <div className="text-xs text-muted-foreground">Name, email, role, and company</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <InfoField icon={User} label="Full name" value={name} />
                <InfoField icon={Mail} label="Email" value={user?.email ?? "—"} />
                <InfoField icon={Phone} label="Phone" value="+1 (415) 555-0123" />
                <InfoField icon={User} label="Role" value={roleLabel} />
                <InfoField icon={Building2} label="Company" value={company} />
                <InfoField icon={MapPin} label="Location" value="San Francisco, CA, USA" />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="preferences" className="rounded-xl border border-border bg-card shadow-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:rounded-t-xl [&[data-state=open]]:bg-muted/20">
            <div className="flex items-center gap-3 text-left">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-info/10 text-info">
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Preferences</div>
                <div className="text-xs text-muted-foreground">Notification and display settings</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            <div className="grid gap-6 sm:grid-cols-2">
              <PreferenceRow
                icon={Bell}
                label="Email notifications"
                description="Receive updates by email"
                defaultChecked
              />
              <PreferenceRow
                icon={Globe}
                label="Language"
                description="English"
                defaultChecked={false}
                isValue
              />
              <PreferenceRow
                icon={Clock}
                label="Time zone"
                description="(GMT-08:00) Pacific Time"
                defaultChecked={false}
                isValue
              />
              <PreferenceRow
                icon={Eye}
                label="Profile visibility"
                description="Visible to workspace members"
                defaultChecked={false}
                isValue
              />
              <PreferenceRow
                icon={Smartphone}
                label="Communication preferences"
                description="Email and in-app"
                defaultChecked={false}
                isValue
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="account" className="rounded-xl border border-border bg-card shadow-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:rounded-t-xl [&[data-state=open]]:bg-muted/20">
            <div className="flex items-center gap-3 text-left">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Account Settings</div>
                <div className="text-xs text-muted-foreground">Security, password, and linked accounts</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Change password</div>
                    <div className="text-xs text-muted-foreground">Last updated 3 months ago</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Update
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Two-factor authentication</div>
                    <div className="text-xs text-muted-foreground">Not enabled</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Enable
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Linked accounts</div>
                    <div className="text-xs text-muted-foreground">Google connected</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Active sessions</div>
                    <div className="text-xs text-muted-foreground">1 active session</div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity" className="rounded-xl border border-border bg-card shadow-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:rounded-t-xl [&[data-state=open]]:bg-muted/20">
            <div className="flex items-center gap-3 text-left">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent/10 text-accent-foreground">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Activity</div>
                <div className="text-xs text-muted-foreground">Recent updates, saved items, and requests</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 pt-2">
            <div className="space-y-3">
              <ActivityRow
                icon={FileText}
                title="Updated startup profile"
                description="AppMan — 2 hours ago"
              />
              <ActivityRow
                icon={Heart}
                title="Added AppMan to favorites"
                description="Favorites — yesterday"
              />
              <ActivityRow
                icon={UserPlus}
                title="Requested connection with ACME Ventures"
                description="Connections — 3 days ago"
              />
              <ActivityRow
                icon={Bell}
                title="Enabled deal alerts"
                description="Preferences — 1 week ago"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function CircleSummary({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone: "primary" | "accent" | "success" | "info";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    accent: "bg-accent/15 text-accent-foreground border-accent/20",
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "grid h-20 w-20 place-items-center rounded-full border-2 shadow-sm transition-transform hover:scale-105",
          toneClasses[tone],
        )}
      >
        <div className="flex flex-col items-center gap-0.5">
          <Icon className="h-5 w-5" />
          <span className="text-lg font-semibold leading-none">{value}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function PreferenceRow({
  icon: Icon,
  label,
  description,
  defaultChecked,
  isValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  defaultChecked: boolean;
  isValue?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {isValue ? (
        <span className="text-xs font-medium text-foreground">{description}</span>
      ) : (
        <Switch defaultChecked={defaultChecked} />
      )}
    </div>
  );
}

function ActivityRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
