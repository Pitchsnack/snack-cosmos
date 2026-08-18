import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Bot, Info } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "@/components/permission-guard";
import { Button } from "@/components/ui/button";
import { SetupSection } from "@/components/ai-agents/setup-section";
import { ScheduleSection } from "@/components/ai-agents/schedule-section";
import { StatusResultsSection } from "@/components/ai-agents/status-results-section";
import { useAgentRuntime } from "@/hooks/use-ai-agents";
import {
  AI_AGENT_DISCLAIMER,
  markNotificationsRead,
  startRun,
} from "@/lib/ai-agents/agent-runtime";
import type { SearchCriteria } from "@/lib/ai-agents/types";

export const Route = createFileRoute("/_authenticated/ai-agents")({
  head: () => ({
    meta: [
      { title: "Find Startups AI Agent — SnackPortal2" },
      {
        name: "description",
        content:
          "Control-only AI Agent workspace: configure the Find Startups agent, schedule runs, monitor background progress and approve AI Drafts into Global Startups.",
      },
      { property: "og:title", content: "Find Startups AI Agent — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Configure, schedule and monitor the Find Startups AI Agent, review structured results with source evidence and approve AI Drafts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiAgentsPage,
});

function AiAgentsPage() {
  return (
    <PermissionGuard
      permission="global_startups.write"
      message="AI Agents are available to Control users only."
    >
      <AiAgentsInner />
    </PermissionGuard>
  );
}

const EMPTY: SearchCriteria = {
  industries: [],
  productTags: [],
  marketTags: [],
  regions: [],
  countries: [],
};

function AiAgentsInner() {
  const [criteria, setCriteria] = useState<SearchCriteria>(EMPTY);
  const { runs, drafts, schedules, notifications } = useAgentRuntime();
  const unread = notifications.filter((n) => !n.read);

  const runNow = () => {
    const run = startRun(criteria);
    toast.success(`${run.id} started. It keeps running in the background.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Control · AI Agents
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Bot className="h-7 w-7 text-primary" /> Find Startups AI Agent
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Configure, schedule and monitor specialized AI Agents. AI Drafts are never official
            Global Startup records — Control approval is always required.
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" onClick={markNotificationsRead}>
            <Bell className="mr-2 h-4 w-4" /> {unread.length} run notification
            {unread.length > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {unread.length > 0 && (
        <div className="space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          {unread.map((n) => (
            <div key={n.id}>{n.message}</div>
          ))}
        </div>
      )}

      <div className="flex gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{AI_AGENT_DISCLAIMER}</span>
      </div>

      <SetupSection
        criteria={criteria}
        onChange={setCriteria}
        onRunNow={runNow}
        onSchedule={() =>
          document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" })
        }
      />
      <ScheduleSection criteria={criteria} schedules={schedules} />
      <StatusResultsSection runs={runs} drafts={drafts} />
    </div>
  );
}
