import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Download,
  FileText,
  Globe,
  Lock,
  Pencil,
  Save,
  Target,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  buildStrategyExport,
  useAcquisitionStrategy,
  type AcquisitionRequirements,
} from "@/lib/acquisition/strategy-store";
import type { StartupDetail } from "@/lib/startups.functions";
import { TargetCompaniesSection } from "@/components/acquisition/target-companies-section";
import { CompetitorReferencesSection } from "@/components/acquisition/competitor-references-section";
import { RequirementsSection, RequirementsForm } from "@/components/acquisition/requirements-section";
import { InsightsTab } from "@/components/acquisition/insights-tab";
import { LinkedStartupPanel } from "@/components/acquisition/linked-startup-panel";

export type AcquisitionTab = "overview" | "targets" | "competitors" | "requirements" | "insights";

function StartupNavLink({
  to,
  params,
  search,
  icon: Icon,
  label,
  active = false,
}: {
  to: string;
  params: { id: string };
  search?: Record<string, string>;
  icon: typeof UserCircle;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent/15 font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground/90">{children}</div>
    </div>
  );
}

export function AcquisitionStrategyPage({
  startup,
  tab,
  canEdit,
  panelStartupId,
}: {
  startup: StartupDetail;
  tab: AcquisitionTab;
  canEdit: boolean;
  /** Linked startup whose information panel is open as an overlay (from ?panel=). */
  panelStartupId: string | null;
}) {
  const navigate = useNavigate();
  const { strategy, update } = useAcquisitionStrategy(startup.id);
  const [reqDraft, setReqDraft] = useState<AcquisitionRequirements>(strategy.requirements);

  // Keep the requirements-tab draft in sync when the store changes externally.
  useEffect(() => {
    setReqDraft(strategy.requirements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy.updatedAt, startup.id]);

  const setTab = (next: AcquisitionTab) => {
    void navigate({
      to: "/my-startups/$id/acquisition",
      params: { id: startup.id },
      search: { tab: next },
      replace: true,
    });
  };

  // Linked startup information panel — a temporary overlay on this page, never
  // a navigation destination. Opening pushes a history entry so the browser
  // Back button closes the overlay and lands on this same Acquisition Strategy
  // page/tab; closing restores the previous scroll position.
  const [panelId, setPanelId] = useState<string | null>(panelStartupId);
  const scrollRef = useRef(0);
  useEffect(() => {
    if (panelId && !panelStartupId) {
      // Closed via browser Back/Forward — restore the pre-overlay scroll.
      const y = scrollRef.current;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    setPanelId(panelStartupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelStartupId]);

  const openLinkedStartup = (linkedId: string) => {
    scrollRef.current = window.scrollY;
    setPanelId(linkedId);
    void navigate({
      to: "/my-startups/$id/acquisition",
      params: { id: startup.id },
      search: { tab, panel: linkedId },
    });
  };

  const closeLinkedStartup = () => {
    setPanelId(null);
    void navigate({
      to: "/my-startups/$id/acquisition",
      params: { id: startup.id },
      search: { tab },
      replace: true,
    });
    const y = scrollRef.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  const exportStrategy = () => {
    const text = buildStrategyExport(startup.startup_name, strategy);
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${startup.startup_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-acquisition-strategy.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Acquisition strategy exported");
  };

  const saveAll = () => {
    // Mutations persist immediately; this gives the user an explicit checkpoint.
    update((d) => d);
    toast.success("Acquisition strategy saved");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> MY WORKSPACE
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Acquisition Strategy</h1>
            <Badge variant="outline" className="gap-1 border-accent/50 bg-accent/10 text-accent-foreground">
              <Lock className="h-3 w-3" /> Private
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Define companies we want to acquire and criteria for discovering ideal acquisition
            targets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportStrategy}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export Strategy
          </Button>
          {canEdit && (
            <Button size="sm" onClick={saveAll}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save Strategy
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left column — startup summary + navigation */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                  {startup.logo_signed_url ? (
                    <img
                      src={startup.logo_signed_url}
                      alt={`${startup.startup_name} logo`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {startup.startup_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{startup.startup_name}</div>
                  {startup.registered_name && (
                    <div className="truncate text-xs text-muted-foreground">
                      {startup.registered_name}
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
                  <Link to="/my-startups/$id/edit" params={{ id: startup.id }}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Link>
                </Button>
              )}
            </div>

            {startup.investment_stage && (
              <Badge variant="secondary" className="mt-3">
                {startup.investment_stage}
              </Badge>
            )}

            <div className="mt-4 space-y-3">
              {startup.industry.length > 0 && (
                <SummaryRow label="Industry">{startup.industry.join(", ")}</SummaryRow>
              )}
              {startup.market_tags.length > 0 && (
                <SummaryRow label="Market">{startup.market_tags.join(" | ")}</SummaryRow>
              )}
              {startup.headquarters && <SummaryRow label="Headquarters">{startup.headquarters}</SummaryRow>}
              {startup.website_url && (
                <SummaryRow label="Website">
                  <a
                    href={
                      /^https?:\/\//i.test(startup.website_url)
                        ? startup.website_url
                        : `https://${startup.website_url}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-900 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {startup.website_url.replace(/^https?:\/\//i, "")}
                  </a>
                </SummaryRow>
              )}
            </div>

            <div className="mt-5 border-t border-border/50 pt-4">
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Startup Navigation
              </div>
              <nav className="space-y-0.5">
                <StartupNavLink
                  to="/my-startups/$id"
                  params={{ id: startup.id }}
                  icon={UserCircle}
                  label="Profile"
                />
                <StartupNavLink
                  to="/my-startups/$id/edit"
                  params={{ id: startup.id }}
                  search={{ tab: "edit" }}
                  icon={FileText}
                  label="Information"
                />
                <StartupNavLink
                  to="/my-startups/$id/edit"
                  params={{ id: startup.id }}
                  search={{ tab: "basic-restrictions" }}
                  icon={Lock}
                  label="Private Information"
                />
                <StartupNavLink
                  to="/my-startups/$id/acquisition"
                  params={{ id: startup.id }}
                  icon={Target}
                  label="Acquisition Strategy"
                  active
                />
              </nav>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            This information is private and visible only to authorized users in this workspace.
          </div>
        </aside>

        {/* Right column — tabs */}
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as AcquisitionTab)} className="w-full">
            <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border/60 bg-transparent p-0">
              {(
                [
                  ["overview", "Overview"],
                  ["targets", "Target Companies"],
                  ["competitors", "Competitor References"],
                  ["requirements", "Acquisition Requirements"],
                  ["insights", "Insights"],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <TargetCompaniesSection
                strategy={strategy}
                update={update}
                canEdit={canEdit}
                numberedTitle="1. Companies We Want to Acquire"
                onOpenLinked={openLinkedStartup}
              />
              <CompetitorReferencesSection
                strategy={strategy}
                update={update}
                canEdit={canEdit}
                numberedTitle="2. Competitor Acquisition References"
                onOpenLinked={openLinkedStartup}
              />
              <RequirementsSection
                strategy={strategy}
                update={update}
                startup={startup}
                canEdit={canEdit}
                numberedTitle="3. Acquisition Requirements"
              />
            </TabsContent>

            <TabsContent value="targets" className="mt-6">
              <TargetCompaniesSection
                strategy={strategy}
                update={update}
                canEdit={canEdit}
                expanded
                onOpenLinked={openLinkedStartup}
              />
            </TabsContent>

            <TabsContent value="competitors" className="mt-6">
              <CompetitorReferencesSection
                strategy={strategy}
                update={update}
                canEdit={canEdit}
                expanded
                onOpenLinked={openLinkedStartup}
              />
            </TabsContent>

            <TabsContent value="requirements" className="mt-6">
              <section className="rounded-lg border border-border bg-card p-5 shadow-card">
                <h2 className="text-sm font-semibold">Acquisition Requirements</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Define the types of companies we want to find and acquire. Suggestions are
                  prefilled from the startup profile where available.
                </p>
                <div className="mt-5">
                  <RequirementsForm value={reqDraft} onChange={setReqDraft} startup={startup} />
                </div>
                {canEdit && (
                  <div className="mt-5 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        update((d) => ({ ...d, requirements: reqDraft }));
                        toast.success("Acquisition requirements saved");
                      }}
                    >
                      <Save className="mr-1 h-3.5 w-3.5" /> Save Requirements
                    </Button>
                  </div>
                )}
              </section>
            </TabsContent>

            <TabsContent value="insights" className="mt-6">
              <InsightsTab strategy={strategy} startupName={startup.startup_name} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Linked startup information panel — overlay that always returns here. */}
      <LinkedStartupPanel startupId={panelId} onClose={closeLinkedStartup} />
    </div>
  );
}
