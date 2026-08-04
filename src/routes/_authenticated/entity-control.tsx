import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronDown, Plus, Sparkles, Rocket, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGuard } from "@/components/permission-guard";
import { StartupControlTab } from "@/components/entity-control/startup-control-tab";
import { InvestorControlTab } from "@/components/entity-control/investor-control-tab";
import { DraftControlTab } from "@/components/entity-control/draft-control-tab";
import { DRAFT_TOTALS } from "@/lib/entity-control/drafts-adapter";
import { cn } from "@/lib/utils";

const TABS = ["startups", "investors", "drafts"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/entity-control")({
  head: () => ({
    meta: [
      { title: "Control Data Intelligence — SnackPortal2" },
      {
        name: "description",
        content:
          "Create, review, manage and publish global startup and investor records, and validate AI-extracted drafts before publication.",
      },
      { property: "og:title", content: "Control Data Intelligence — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Control-level management of startups, investors and AI draft extraction with explicit publication decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  component: EntityControlPage,
});

function EntityControlPage() {
  return (
    <PermissionGuard
      permission="global_startups.write"
      message="You don't have permission to access Entity Control."
    >
      <EntityControlInner />
    </PermissionGuard>
  );
}

function EntityControlInner() {
  const navigate = useNavigate({ from: "/entity-control" });
  const search = Route.useSearch();
  const tab: Tab = search.tab ?? "startups";
  const [pill] = useState(() => "200,000+");

  const setTab = (t: Tab) => navigate({ search: { tab: t } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Control · Control Data Intelligence
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Control Data Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, review, manage and publish startups and investors. Control records stay separate
            from tenant records.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> New Record
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate({ to: "/startups/new" })}>
              New Startup
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/investors/new" })}>
              New Investor / VC
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <TabCard
          active={tab === "startups"}
          icon={Rocket}
          label="Startups"
          meta={pill}
          onClick={() => setTab("startups")}
        />
        <TabCard
          active={tab === "investors"}
          icon={Users}
          label="Investors / VCs"
          meta={pill}
          onClick={() => setTab("investors")}
        />
        <TabCard
          active={tab === "drafts"}
          icon={Sparkles}
          label="AI Draft Extraction"
          meta={`${(DRAFT_TOTALS.startup + DRAFT_TOTALS.investor).toLocaleString()} drafts`}
          onClick={() => setTab("drafts")}
        />
      </div>

      {tab === "startups" && <StartupControlTab />}
      {tab === "investors" && <InvestorControlTab />}
      {tab === "drafts" && <DraftControlTab />}
    </div>
  );
}

function TabCard({
  active,
  icon: Icon,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  icon: typeof Rocket;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        active
          ? "border-accent bg-accent/5 text-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon className={cn("h-4 w-4", active && "text-accent")} />
        {label}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{meta}</span>
    </button>
  );
}
