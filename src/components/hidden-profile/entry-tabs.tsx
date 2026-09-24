import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StartupDetailPanel } from "@/components/startups/startup-detail-panel";
import { useStartup } from "@/hooks/use-startup";
import { useEntryFacts, useHiddenProfile, useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import { hiddenStatusOf, isStartupEntry, STATUS_LABEL } from "@/lib/hidden-profile";
import { HiddenProfileTab } from "./hidden-profile-tab";
import { CompareTab } from "./compare-tab";
import { HiddenProfileEditor } from "./hidden-profile-editor";
import { MarkerLegend } from "./bits";
import { cn } from "@/lib/utils";

export type EntryTab = "full" | "hidden" | "compare";

const MARKER_KEY = "ps.showMarkers";
function useShowMarkers() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const v = localStorage.getItem(MARKER_KEY);
    if (v === "0") setShow(false);
  }, []);
  return [show, (v: boolean) => { setShow(v); localStorage.setItem(MARKER_KEY, v ? "1" : "0"); }] as const;
}

type PanelProps = Omit<Parameters<typeof StartupDetailPanel>[0], "belowHeader" | "replaceBody" | "extraMenuItems">;

/** The entry's header + Full profile · Hidden profile · Compare, used in the Split panel and the information box. */
export function EntryProfileTabs({
  tab,
  onTabChange,
  editing,
  onEditingChange,
  ...panel
}: PanelProps & {
  tab: EntryTab;
  onTabChange: (t: EntryTab) => void;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  const id = panel.id;
  const { data: s } = useStartup(id);
  const { row } = useHiddenProfile(id);
  const { data: facts } = useEntryFacts(id);
  const actions = useHiddenProfileActions();
  const [showMarkers, setShowMarkers] = useShowMarkers();
  const [publishOnOpen, setPublishOnOpen] = useState(false);
  const companyType = s?.company_type ?? null;
  const status = hiddenStatusOf(row, companyType);
  const industry = s?.sector || s?.industry?.[0] || "—";
  const startupEntry = isStartupEntry(companyType);

  const openEditor = async () => {
    onTabChange("hidden");
    if (!row && !startupEntry) {
      try { await actions.create.mutateAsync({ startupId: id }); } catch { return; }
    }
    onEditingChange(true);
  };

  const tabs = (
    <div className="space-y-2">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {([
          ["full", "Full profile"],
          ["hidden", "Hidden profile"],
          ["compare", "Compare"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => { onTabChange(k); onEditingChange(false); }}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === k ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {k === "hidden" && (
              <span className={cn("rounded-full px-1.5 text-[10px]",
                status === "live" || status === "live_edited" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : status === "draft" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>
                {STATUS_LABEL[status]}
              </span>
            )}
          </button>
        ))}
      </div>
      {!editing && <MarkerLegend show={showMarkers} onToggle={setShowMarkers} />}
    </div>
  );

  let body: React.ReactNode = undefined;
  if (tab === "hidden") {
    body = editing && row ? (
      <HiddenProfileEditor
        row={row}
        facts={facts}
        directoryDescription={s?.short_description}
        autoPublish={publishOnOpen}
        onBack={() => { onEditingChange(false); setPublishOnOpen(false); }}
      />
    ) : (
      <HiddenProfileTab
        name={s?.startup_name ?? "This entry"}
        companyType={companyType}
        row={row}
        facts={facts}
        industry={industry}
        showMarkers={showMarkers}
        creating={actions.create.isPending}
        onCreate={openEditor}
        onEdit={() => onEditingChange(true)}
        onPublish={() => { setPublishOnOpen(true); onEditingChange(true); }}
      />
    );
  } else if (tab === "compare") {
    body = <CompareTab facts={facts} row={row} industry={industry} showMarkers={showMarkers} s={s ?? {}} />;
  }

  return (
    <StartupDetailPanel
      {...panel}
      belowHeader={tabs}
      replaceBody={body}
      extraMenuItems={
        startupEntry ? null : (
          <DropdownMenuItem onSelect={() => void openEditor()}>
            <EyeOff className="mr-2 h-4 w-4" /> {row ? "Edit hidden profile" : "Create hidden profile"}
          </DropdownMenuItem>
        )
      }
    />
  );
}
