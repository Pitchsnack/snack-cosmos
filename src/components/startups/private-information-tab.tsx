import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  Info,
  Upload,
  Building2,
  DollarSign,
  BarChart3,
  Clock,
  PieChart,
  AlertTriangle,
  Users,
  Globe,
  Eye,
  Pencil,
  UserCog,
  FileText,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { StartupDetail } from "@/lib/startups.functions";

type FieldDef = {
  key: string;
  label: string;
  icon: typeof Building2;
  value: string;
};

const STORAGE_KEY = (id: string) => `sp2.private-info.${id}`;

function loadRestrictions(id: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY(id)) ?? "{}");
  } catch {
    return {};
  }
}

function saveRestrictions(id: string, r: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY(id), JSON.stringify(r));
}

const MOCK_DOCS = [
  { name: "Financial Model.xlsx", type: "Financial", by: "Alex Morgan", date: "May 12, 2024" },
  { name: "Cap Table.xlsx", type: "Cap Table", by: "Alex Morgan", date: "May 11, 2024" },
  { name: "Pitch Deck (Confidential).pdf", type: "Presentation", by: "Alex Morgan", date: "May 10, 2024" },
  { name: "Due Diligence Checklist.docx", type: "Legal", by: "Alex Morgan", date: "May 9, 2024" },
  { name: "Investor Update – Q1 2024.pdf", type: "Reports", by: "Alex Morgan", date: "May 7, 2024" },
];

export function PrivateInformationTab({ startup }: { startup: StartupDetail }) {
  const [restrictions, setRestrictions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRestrictions(loadRestrictions(startup.id));
  }, [startup.id]);

  const fields = useMemo<FieldDef[]>(
    () => [
      { key: "company_description", label: "Company Description", icon: Building2, value: startup.short_description ?? "—" },
      { key: "revenue_range", label: "Revenue Range", icon: DollarSign, value: "$1M – $5M" },
      { key: "funding_required", label: "Funding Required", icon: BarChart3, value: "$2M – $5M" },
      { key: "runway", label: "Runway", icon: Clock, value: "12 – 18 months" },
      { key: "valuation_expectation", label: "Valuation Expectation", icon: PieChart, value: "$10M – $20M" },
      { key: "key_commercial_risks", label: "Key Commercial Risks", icon: AlertTriangle, value: "Dependence on weather data, …" },
      { key: "team_ownership", label: "Team Ownership", icon: Users, value: "Not visible" },
      { key: "website", label: "Website", icon: Globe, value: startup.website_url ?? "—" },
    ],
    [startup],
  );

  const toggle = (key: string) => {
    setRestrictions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveRestrictions(startup.id, next);
      return next;
    });
  };

  const handleSave = () => {
    saveRestrictions(startup.id, restrictions);
    toast.success("Private information saved");
  };

  return (
    <div className="space-y-5">
      {/* Notice banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200/70 bg-amber-50/70 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">Private Information</div>
          <div className="text-xs text-muted-foreground">
            Only authorized users in your workspace can view or edit the information on this tab.
          </div>
        </div>
        <button type="button" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">
          Learn more
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Phase 1 */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              Phase 1
            </span>
            <h3 className="text-sm font-semibold">Information in Edit Startup to be Censored</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Select which information from the public Edit Startup will be hidden from all non-authorized users.
          </p>

          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>Information Field</div>
              <div>Current Value (Public)</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      Restrict <Info className="h-3 w-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Hide this value from non-authorized viewers</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="divide-y divide-border/50">
              {fields.map((f) => {
                const Icon = f.icon;
                const on = !!restrictions[f.key];
                return (
                  <div
                    key={f.key}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{f.label}</span>
                    </div>
                    {on ? (
                      <div className="h-4 w-4/5 rounded bg-muted-foreground/30" aria-label="Restricted" />
                    ) : (
                      <div className="truncate text-foreground/80">{f.value}</div>
                    )}
                    <Switch checked={on} onCheckedChange={() => toggle(f.key)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Restricted information will be hidden from all public views including grid, list, split,
              details, search, exports, and shared links.
            </span>
          </div>
        </section>

        {/* Phase 2 */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Phase 2
              </span>
              <h3 className="text-sm font-semibold">Additional Sensitive Documents</h3>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload
            </Button>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Upload and manage additional confidential documents.
          </p>

          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="grid grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_auto] items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>Document Name</div>
              <div>Type</div>
              <div>Uploaded By</div>
              <div>Date</div>
              <div className="pr-1">Actions</div>
            </div>
            <div className="divide-y divide-border/50">
              {MOCK_DOCS.map((d) => (
                <div
                  key={d.name}
                  className="grid grid-cols-[1.5fr_0.8fr_0.9fr_0.7fr_auto] items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                      {d.type}
                    </span>
                  </div>
                  <div className="truncate text-foreground/80">{d.by}</div>
                  <div className="text-muted-foreground">{d.date}</div>
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Row actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 border-t border-border/60 bg-muted/20 py-2 text-xs font-medium text-primary hover:bg-muted/40"
            >
              View all documents ({MOCK_DOCS.length}) <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Access */}
          <div className="mt-5 rounded-lg border border-border/60 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-semibold">Access to Private Information</div>
                  <div className="text-xs text-muted-foreground">
                    Manage who can view or edit the information in Phase 1 and Phase 2.
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5">
                <UserCog className="h-3.5 w-3.5" /> Manage Access
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-muted-foreground" /> Can view
                </div>
                <div className="mt-1 text-xs text-muted-foreground">4 users, 2 roles</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Pencil className="h-4 w-4 text-muted-foreground" /> Can edit
                </div>
                <div className="mt-1 text-xs text-muted-foreground">2 users, 1 role</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Lock className="h-4 w-4" /> Save private information
        </Button>
      </div>
    </div>
  );
}
