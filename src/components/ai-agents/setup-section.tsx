import { useState } from "react";
import { Bot, CheckCircle2, Info, Play, CalendarClock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagPicker } from "@/components/ai-agents/tag-picker";
import {
  AGENT_CATALOGUE,
  COUNTRY_OPTIONS,
  INDUSTRY_OPTIONS,
  MARKET_TAG_OPTIONS,
  PRODUCT_TAG_OPTIONS,
  REGION_OPTIONS,
  SOURCE_POLICY,
} from "@/lib/ai-agents/agent-runtime";
import type { AgentId, SearchCriteria } from "@/lib/ai-agents/types";
import { cn } from "@/lib/utils";

export function SetupSection({
  criteria,
  onChange,
  onRunNow,
  onSchedule,
}: {
  criteria: SearchCriteria;
  onChange: (c: SearchCriteria) => void;
  onRunNow: () => void;
  onSchedule: () => void;
}) {
  const [agent, setAgent] = useState<AgentId>("find_startups");
  const set = <K extends keyof SearchCriteria>(k: K, v: SearchCriteria[K]) =>
    onChange({ ...criteria, [k]: v });

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <h2 className="text-xl font-semibold tracking-tight">Setup AI Agent</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the Find Startups AI Agent to discover startups that match your criteria.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold">Select AI Agent Type</h3>
            <p className="text-xs text-muted-foreground">
              Choose the specialized AI Agent you want to run.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {AGENT_CATALOGUE.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.available}
                  onClick={() => setAgent(a.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition",
                    agent === a.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40",
                    !a.available && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    {agent === a.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{a.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{a.description}</div>
                  {!a.available && (
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Not in MVP
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Define Your Search Criteria</h3>
            <p className="text-xs text-muted-foreground">
              Find startups that match all (AND) of the criteria below.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <TagPicker
                label="Industry"
                placeholder="Select industries"
                options={INDUSTRY_OPTIONS}
                value={criteria.industries}
                onChange={(v) => set("industries", v)}
              />
              <TagPicker
                label="Product & Service Tags"
                placeholder="Select tags"
                options={PRODUCT_TAG_OPTIONS}
                value={criteria.productTags}
                onChange={(v) => set("productTags", v)}
              />
              <TagPicker
                label="Market Tags"
                placeholder="Select market tags"
                options={MARKET_TAG_OPTIONS}
                value={criteria.marketTags}
                onChange={(v) => set("marketTags", v)}
              />
              <TagPicker
                label="Region"
                placeholder="Select regions"
                options={REGION_OPTIONS}
                value={criteria.regions}
                onChange={(v) => set("regions", v)}
              />
              <TagPicker
                label="Country"
                placeholder="Select countries"
                options={COUNTRY_OPTIONS}
                value={criteria.countries}
                onChange={(v) => set("countries", v)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Allowed Sources
            </div>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {SOURCE_POLICY.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onSchedule}>
              <CalendarClock className="mr-2 h-4 w-4" /> Schedule
            </Button>
            <Button onClick={onRunNow}>
              <Play className="mr-2 h-4 w-4" /> Run Now
            </Button>
          </div>
        </div>

        <aside className="rounded-lg border border-border p-4">
          <div className="text-sm font-semibold">
            Output Fields <span className="text-muted-foreground">(Find Startups)</span>
          </div>
          <p className="text-xs text-muted-foreground">The AI Agent will return these fields.</p>

          <div className="mt-3 space-y-2">
            <FieldRow tone="required" name="Startup Name" hint="Name of the startup company" />
            <FieldRow tone="required" name="Website" hint="Official website URL" />
            <FieldRow tone="optional" name="Year Founded" hint="Year the company was founded" />
            <FieldRow tone="optional" name="Country" hint="Country where the company is based" />
            <FieldRow tone="optional" name="City" hint="City where the company is based" />
          </div>

          <div className="mt-3 flex gap-2 rounded-md bg-primary/5 p-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              At minimum, <strong className="text-foreground">Startup Name</strong> and{" "}
              <strong className="text-foreground">Website</strong> will always be returned.
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FieldRow({
  tone,
  name,
  hint,
}: {
  tone: "required" | "optional";
  name: string;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
          tone === "required"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-border bg-muted text-muted-foreground",
        )}
      >
        {tone === "required" ? "Required" : "Optional"}
      </span>
    </div>
  );
}
