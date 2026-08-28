import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, Lock, Pencil, Save } from "lucide-react";
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
import type { CompetitorReference, TargetCompany } from "@/lib/acquisition/strategy-store";
import { TargetCompaniesSection } from "@/components/acquisition/target-companies-section";
import { CompetitorReferencesSection } from "@/components/acquisition/competitor-references-section";
import { RequirementsSection, RequirementsForm } from "@/components/acquisition/requirements-section";
import { InsightsTab } from "@/components/acquisition/insights-tab";
import { LinkedStartupPanel } from "@/components/acquisition/linked-startup-panel";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { AcquisitionCompanyPanel } from "@/components/acquisition/acquisition-company-panel";

export type AcquisitionTab = "overview" | "startup-info" | "targets" | "competitors" | "requirements" | "insights";

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

  // Remember where the user came from so Back from Startup Info restores the
  // previous tab and scroll position on this same page.
  const prevTabRef = useRef<AcquisitionTab>(tab === "startup-info" ? "overview" : tab);
  const infoScrollRef = useRef(0);

  const setTab = (next: AcquisitionTab) => {
    if (next === "startup-info" && tab !== "startup-info") {
      prevTabRef.current = tab;
      infoScrollRef.current = window.scrollY;
    }
    void navigate({
      to: "/my-startups/$id/acquisition",
      params: { id: startup.id },
      search: { tab: next },
      replace: true,
    });
  };

  const backFromStartupInfo = () => {
    setTab(prevTabRef.current === "startup-info" ? "overview" : prevTabRef.current);
    const y = infoScrollRef.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
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

  // Manual (unlinked) company information panels — temporary overlays that
  // always return to this Acquisition Strategy page and tab.
  const [companyTarget, setCompanyTarget] = useState<TargetCompany | null>(null);
  const [companyCompetitor, setCompanyCompetitor] = useState<CompetitorReference | null>(null);
  const closeCompanyPanel = () => {
    setCompanyTarget(null);
    setCompanyCompetitor(null);
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
    <div className="space-y-5">
      {/* Compact startup header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30">
            {startup.logo_signed_url ? (
              <img
                src={startup.logo_signed_url}
                alt={`${startup.startup_name} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-base font-semibold text-muted-foreground">
                {startup.startup_name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {startup.startup_name}
            </h1>
            {startup.investment_stage && (
              <Badge variant="secondary">{startup.investment_stage}</Badge>
            )}
            <Badge
              variant="outline"
              className="gap-1 border-accent/50 bg-accent/10 text-accent-foreground"
            >
              <Lock className="h-3 w-3" /> Private
            </Badge>
          </div>
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

      {/* Full-width acquisition workspace */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as AcquisitionTab)} className="w-full">
        <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border/60 bg-transparent p-0">
          {(
            [
              ["overview", "Overview"],
              ["startup-info", "Startup Info"],
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

        <TabsContent value="overview" className="mt-5 space-y-4">
          <TargetCompaniesSection
            strategy={strategy}
            update={update}
            canEdit={canEdit}
            numberedTitle="1. Companies We Want to Acquire"
            onOpenLinked={openLinkedStartup}
            onOpenCompany={setCompanyTarget}
          />
          <CompetitorReferencesSection
            strategy={strategy}
            update={update}
            canEdit={canEdit}
            numberedTitle="2. Competitor Acquisition References"
            onOpenLinked={openLinkedStartup}
            onOpenCompany={setCompanyCompetitor}
          />
          <RequirementsSection
            strategy={strategy}
            update={update}
            startup={startup}
            canEdit={canEdit}
            numberedTitle="3. Acquisition Requirements"
          />
        </TabsContent>

        <TabsContent value="startup-info" className="mt-5">
          <section className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={backFromStartupInfo}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Acquisition Strategy
              </Button>
              {canEdit && (
                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                  <Link to="/my-startups/$id/edit" params={{ id: startup.id }}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit Startup
                  </Link>
                </Button>
              )}
            </div>

            {/* Standard Information Panel presentation */}
            <StartupDetailPanel
              id={startup.id}
              compact
              workspace="my-startups"
              showEdit={false}
              onClose={backFromStartupInfo}
            />

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              This information is private and visible only to authorized users in this workspace.
            </div>
          </section>
        </TabsContent>


        <TabsContent value="targets" className="mt-5">
          <TargetCompaniesSection
            strategy={strategy}
            update={update}
            canEdit={canEdit}
            expanded
            onOpenLinked={openLinkedStartup}
            onOpenCompany={setCompanyTarget}
          />
        </TabsContent>

        <TabsContent value="competitors" className="mt-5">
          <CompetitorReferencesSection
            strategy={strategy}
            update={update}
            canEdit={canEdit}
            expanded
            onOpenLinked={openLinkedStartup}
            onOpenCompany={setCompanyCompetitor}
          />
        </TabsContent>

        <TabsContent value="requirements" className="mt-5">
          <section className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">Acquisition Requirements</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Define the types of companies we want to find and acquire. Suggestions are prefilled
              from the startup profile where available.
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

        <TabsContent value="insights" className="mt-5">
          <InsightsTab strategy={strategy} startupName={startup.startup_name} />
        </TabsContent>
      </Tabs>

      {/* Linked startup information panel — overlay that always returns here. */}
      <LinkedStartupPanel startupId={panelId} onClose={closeLinkedStartup} />

      {/* Manual target / competitor information panel. */}
      <AcquisitionCompanyPanel
        target={companyTarget}
        competitor={companyCompetitor}
        onClose={closeCompanyPanel}
      />
    </div>
  );
}

