import { createFileRoute } from "@tanstack/react-router";
import {
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Globe,
  Linkedin,
  Pencil,
  Lock,
  ShieldCheck,
  Tag,
  Star,
  ExternalLink,
} from "lucide-react";

import { useSessionContext } from "@/hooks/use-session-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/my-page")({
  head: () => ({
    meta: [
      { title: "My Profile — SnackPortal2" },
      {
        name: "description",
        content: "Manage your professional profile, expertise, tags and account settings.",
      },
      { property: "og:title", content: "My Profile — SnackPortal2" },
      {
        property: "og:description",
        content: "Manage your professional profile, expertise, tags and account settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyPage,
});

const EXPERTISE: Array<[string, string]> = [
  ["Primary Expertise", "Product Strategy"],
  ["Industry Focus", "SaaS, Enterprise Software"],
  ["Stage Focus", "Seed, Series A, Series B"],
  ["Functional Expertise", "Product, Growth, GTM"],
  ["Investment Focus", "B2B SaaS, AI/ML, Enterprise"],
  ["Experience", "15+ years"],
];

const INTERESTS = [
  "AI & Automation",
  "Future of Work",
  "Venture Capital",
  "Leadership",
  "SaaS Innovation",
  "Workforce Tech",
];

const TAGS = [
  "Product Strategy",
  "SaaS",
  "Enterprise",
  "B2B",
  "AI/ML",
  "Seed Stage",
  "Series A",
  "Series B",
  "Growth",
  "Operations",
];

function MyPage() {
  const { data: session, isLoading } = useSessionContext();
  const user = session?.user;

  const name = "Dan Antakon";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    (user?.email?.[0]?.toUpperCase() ?? "?");
  const roleLabel = session?.roles[0] ? ROLE_LABELS[session.roles[0]] : "Startup User";
  const workspaceName =
    session?.activeWorkspace.tenantName ??
    session?.tenants[0]?.tenantName ??
    (session?.roles.includes("CONTROL") ? "Control" : "—");
  const workspaceTypeLabel =
    session?.activeWorkspace.workspaceType === "CONTROL"
      ? "Control Platform"
      : "Startup Portfolio";
  const email = user?.email ?? "—";

  return (
    <div className="-mx-8 -mt-10 -mb-10 min-h-screen bg-white px-8 pt-10 pb-10">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your profile, expertise, tags and account settings.
          </p>
        </div>

        {/* Profile header */}
        <Card className="overflow-hidden border border-border bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
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

              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">Founder &amp; CEO</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium">{workspaceName}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {roleLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Building the future of workforce management.
                </p>

                <div className="grid gap-x-8 gap-y-1.5 pt-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    +1 (415) 555-0123
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    San Francisco, CA, USA
                  </span>
                  <a
                    href="https://www.xynal.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">www.xynal.com</span>
                  </a>
                  <a
                    href="https://linkedin.com/in/danlee"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                  >
                    <Linkedin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">linkedin.com/in/danlee</span>
                  </a>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Joined May 12, 2024
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div className="flex items-center gap-4 rounded-xl bg-purple-50 px-5 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-purple-600/80">Current Workspace</div>
                  <div className="truncate text-sm font-semibold text-purple-900">
                    {workspaceName}
                  </div>
                  <div className="text-xs text-purple-600/70">{workspaceTypeLabel}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Three-column content */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: Personal Information */}
          <SectionCard title="Personal Information" onEdit>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            ) : (
              <div className="divide-y divide-border">
                <InfoRow label="Full Name" value={name} />
                <div className="py-2.5 first:pt-0">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="inline-flex max-w-[60%] items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-right text-sm text-muted-foreground">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span className="truncate">{email}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    Login email — cannot be changed here
                  </p>
                </div>
                <InfoRow label="Phone" value="+1 (415) 555-0123" />
                <InfoRow label="Position / Title" value="Founder & CEO" />
                <InfoRow label="Organisation" value="Xynal" />
                <InfoRow label="Location" value="San Francisco, CA, USA" />
                <InfoRow label="Timezone" value="(GMT-08:00) Pacific Time (US & Canada)" />
                <InfoRow label="Website" value="www.xynal.com" href="https://www.xynal.com" />
                <InfoRow
                  label="LinkedIn"
                  value="linkedin.com/in/danlee"
                  href="https://linkedin.com/in/danlee"
                />
                <InfoRow
                  label="Bio"
                  value="Building the future of workforce management."
                />
              </div>
            )}
          </SectionCard>

          {/* Middle: Expertise + Interests */}
          <div className="space-y-5">
            <SectionCard title="Expertise" onEdit>
              <div className="divide-y divide-border">
                {EXPERTISE.map(([label, value]) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Interests" onEdit>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    <Star className="h-3 w-3" />
                    {i}
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Right: Tags + About */}
          <div className="space-y-5">
            <SectionCard title="Tags" onEdit>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"
                  >
                    <Tag className="h-3 w-3" />
                    {t}
                  </span>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="About SnackPortal2">
              <div className="divide-y divide-border">
                <InfoRow label="Role" value={roleLabel} accent />
                <InfoRow label="Current Workspace" value={workspaceName} accent />
                <InfoRow label="Account Type" value="Platform Admin" />
                <InfoRow label="Joined" value="May 12, 2024" />
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Account & Security */}
        <Card className="border border-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Account &amp; Security</h3>
                <p className="text-xs text-muted-foreground">
                  Manage your password and security preferences.
                </p>
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

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {onEdit ? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string;
  href?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-[60%] items-center gap-1 text-right text-sm font-medium text-primary hover:underline"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span
          className={
            accent
              ? "max-w-[60%] text-right text-sm font-medium text-primary"
              : "max-w-[60%] text-right text-sm font-medium"
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}
