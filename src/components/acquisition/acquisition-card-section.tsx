/**
 * Compact ACQUISITION block rendered at the bottom of each My Startups card.
 *
 * Shows a scannable preview of the private per-startup acquisition strategy:
 *  - Target Companies as logo pills (with a linked indicator and +N overflow)
 *  - Competitor References as logo pills
 *  - Acquisition Requirements as compact status chips
 *
 * Interaction rules (per PRD):
 *  - Clicking a target pill opens the Target Company Information Panel.
 *  - Clicking a competitor pill opens the Competitor Reference Panel.
 *  - Clicking a requirement chip opens the Acquisition Requirements Panel.
 *  - "View Strategy" / overflow / empty-state actions jump to the matching
 *    Acquisition Strategy tab.
 * Everything stays in context — pills never trigger the card's own onClick.
 */

import { CheckCircle2, Link2, Plus } from "lucide-react";

import { useAcquisitionStrategy } from "@/lib/acquisition/strategy-store";
import { cn } from "@/lib/utils";

export type AcquisitionPanelRequest =
  | { type: "target"; id: string }
  | { type: "competitor"; id: string }
  | { type: "requirements" };

export type AcquisitionCardTab = "overview" | "targets" | "competitors" | "requirements";

const MAX_PILLS = 3;

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Interactive element inside a card whose root is itself clickable. Uses a
 * span with role="button" (never a nested <button>/<a>) so the markup stays
 * valid, and stops propagation so the startup card never opens behind it.
 */
function MiniAction({
  children,
  label,
  onAction,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onAction: () => void;
  className?: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        stop(e);
        onAction();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          stop(e);
          onAction();
        }
      }}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60",
        className,
      )}
    >
      {children}
    </span>
  );
}

function CompanyPill({
  name,
  logo,
  linked,
  label,
  onOpen,
}: {
  name: string;
  logo: string | null;
  linked?: boolean;
  label: string;
  onOpen: () => void;
}) {
  return (
    <MiniAction
      label={label}
      onAction={onOpen}
      className="inline-flex h-5 max-w-[8rem] items-center gap-1 rounded-full border border-border/70 bg-background pl-1 pr-1.5 text-[10px] font-medium text-foreground/80 transition-colors hover:border-accent/60 hover:text-accent"
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {logo ? (
          <img src={logo} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[7px] font-semibold text-muted-foreground">{monogram(name)}</span>
        )}
      </span>
      <span className="truncate">{name}</span>
      {linked && (
        <Link2 className="h-2.5 w-2.5 shrink-0 text-blue-900" aria-label="Linked to an existing startup" />
      )}
    </MiniAction>
  );
}

export function AcquisitionCardSection({
  startupId,
  onOpenPanel,
  onOpenStrategy,
}: {
  startupId: string;
  onOpenPanel: (req: AcquisitionPanelRequest) => void;
  onOpenStrategy: (tab: AcquisitionCardTab) => void;
}) {
  const { strategy } = useAcquisitionStrategy(startupId);
  const { targets, competitors, requirements: req, updatedAt } = strategy;

  const reqChips: string[] = [];
  if (req.industries.length) reqChips.push("Industries");
  if (req.keywords.length) reqChips.push("Keywords");
  if (req.productTags.length) reqChips.push("Products");
  if (req.markets.length) reqChips.push("Markets");
  if (req.stages.length) reqChips.push("Stage");
  const configured = reqChips.length > 0 || !!req.companySize || !!req.strategicReason;

  return (
    <div
      className="mt-auto border-t border-border/50 pt-2"
      onClick={stop}
      onMouseDown={stop}
      data-acquisition-section
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Acquisition
        </span>
        <MiniAction
          label="Open the full Acquisition Strategy page"
          onAction={() => onOpenStrategy("overview")}
          className="shrink-0 text-[10px] font-medium text-blue-900 hover:underline"
        >
          View Strategy →
        </MiniAction>
      </div>

      {/* Target Companies */}
      <div className="mb-1">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
          Target Companies
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {targets.slice(0, MAX_PILLS).map((t) => (
            <CompanyPill
              key={t.id}
              name={t.name}
              logo={t.logo}
              linked={!!t.linkedStartupId}
              label={`Open ${t.name} target information`}
              onOpen={() => onOpenPanel({ type: "target", id: t.id })}
            />
          ))}
          {targets.length > MAX_PILLS && (
            <MiniAction
              label="View all target companies in Acquisition Strategy"
              onAction={() => onOpenStrategy("targets")}
              className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-accent/60 hover:text-accent"
            >
              +{targets.length - MAX_PILLS}
            </MiniAction>
          )}
          {targets.length === 0 && (
            <MiniAction
              label="Add acquisition targets in Acquisition Strategy"
              onAction={() => onOpenStrategy("targets")}
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
            >
              <Plus className="h-2.5 w-2.5" /> Add acquisition targets
            </MiniAction>
          )}
        </div>
      </div>

      {/* Competitor References */}
      <div className="mb-1">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
          Competitor References
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {competitors.slice(0, MAX_PILLS).map((c) => (
            <CompanyPill
              key={c.id}
              name={c.name}
              logo={c.logo}
              linked={!!c.linkedStartupId}
              label={`Open ${c.name} competitor reference`}
              onOpen={() => onOpenPanel({ type: "competitor", id: c.id })}
            />
          ))}
          {competitors.length > MAX_PILLS && (
            <MiniAction
              label="View all competitor references in Acquisition Strategy"
              onAction={() => onOpenStrategy("competitors")}
              className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-accent/60 hover:text-accent"
            >
              +{competitors.length - MAX_PILLS}
            </MiniAction>
          )}
          {competitors.length === 0 && (
            <MiniAction
              label="Add competitors in Acquisition Strategy"
              onAction={() => onOpenStrategy("competitors")}
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
            >
              <Plus className="h-2.5 w-2.5" /> Add competitors
            </MiniAction>
          )}
        </div>
      </div>

      {/* Acquisition Requirements */}
      <div>
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground/80">
          Acquisition Requirements
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {configured ? (
            <>
              {reqChips.map((chip) => (
                <MiniAction
                  key={chip}
                  label="Open the acquisition requirements summary"
                  onAction={() => onOpenPanel({ type: "requirements" })}
                  className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70 hover:border-accent/60 hover:text-accent"
                >
                  {chip}
                </MiniAction>
              ))}
              <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <CheckCircle2 className="h-2.5 w-2.5" /> Configured
              </span>
            </>
          ) : (
            <MiniAction
              label="Add acquisition requirements in Acquisition Strategy"
              onAction={() => onOpenStrategy("requirements")}
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
            >
              <Plus className="h-2.5 w-2.5" /> Add acquisition requirements
            </MiniAction>
          )}
        </div>
      </div>

      {updatedAt && formatUpdated(updatedAt) && (
        <div className="mt-1 text-[9px] text-muted-foreground/70">
          Updated {formatUpdated(updatedAt)}
        </div>
      )}
    </div>
  );
}
