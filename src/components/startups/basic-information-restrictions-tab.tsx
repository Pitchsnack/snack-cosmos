import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  Image as ImageIcon,
  Images,
  Type,
  FileText,
  Briefcase,
  TrendingUp,
  Calendar,
  MapPin,
  Globe,
  Building2,
  Tag,
  Linkedin,
  Users,
  CheckSquare,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { StartupDetail } from "@/lib/startups.functions";

type FieldDef = {
  key: string;
  label: string;
  icon: typeof Type;
  render: (s: StartupDetail) => React.ReactNode;
};

/** Restriction scopes are intentionally independent per module. */
export type RestrictionsScope = "startups" | "my-startups";

const STORAGE_KEY = (scope: RestrictionsScope, id: string) =>
  `sp2.basic-info-restrictions.${scope}.${id}`;

function loadRestrictions(scope: RestrictionsScope, id: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY(scope, id)) ?? "{}");
  } catch {
    return {};
  }
}

function saveRestrictionsToStorage(
  scope: RestrictionsScope,
  id: string,
  r: Record<string, boolean>,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY(scope, id), JSON.stringify(r));
}

function textOrDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function joinOrDash(v: string[] | null | undefined): string {
  if (!v || v.length === 0) return "—";
  return v.join(", ");
}

const INITIAL_COUNT = 10;

export function BasicInformationRestrictionsTab({ startup }: { startup: StartupDetail }) {
  const [restrictions, setRestrictions] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setRestrictions(loadRestrictions(startup.id));
  }, [startup.id]);

  const fields = useMemo<FieldDef[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = startup as any;
    return [
      {
        key: "logo",
        label: "Company Logo",
        icon: ImageIcon,
        render: () =>
          s.logo_signed_url || s.logo_url ? (
            <img
              src={s.logo_signed_url ?? s.logo_url}
              alt=""
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "media_images",
        label: "Media Images",
        icon: Images,
        render: () => {
          const media: Array<{ signed_url?: string | null; url?: string | null }> =
            s.media ?? s.media_images ?? [];
          if (!media || media.length === 0) return <span className="text-muted-foreground">—</span>;
          const visible = media.slice(0, 3);
          const extra = media.length - visible.length;
          return (
            <div className="flex items-center gap-1.5">
              {visible.map((m, i) => (
                <div
                  key={i}
                  className="h-8 w-10 overflow-hidden rounded bg-muted"
                >
                  {m.signed_url || m.url ? (
                    <img src={m.signed_url ?? m.url ?? ""} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
              ))}
              {extra > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                  +{extra}
                </span>
              )}
            </div>
          );
        },
      },
      { key: "startup_name", label: "Company Name", icon: Type, render: () => textOrDash(s.startup_name) },
      { key: "legal_name", label: "Legal Name", icon: FileText, render: () => textOrDash(s.legal_name) },
      { key: "company_type", label: "Company Type", icon: Briefcase, render: () => textOrDash(s.company_type) },
      { key: "investment_stage", label: "Investment Stage", icon: TrendingUp, render: () => textOrDash(s.investment_stage) },
      { key: "year_founded", label: "Year Founded", icon: Calendar, render: () => textOrDash(s.year_founded) },
      { key: "headquarters", label: "Headquarters", icon: MapPin, render: () => textOrDash(s.headquarters) },
      { key: "country", label: "Country", icon: Globe, render: () => textOrDash(s.country ?? s.region) },
      { key: "city", label: "City", icon: Building2, render: () => textOrDash(s.city) },
      { key: "industry", label: "Industry", icon: Tag, render: () => joinOrDash(s.industry) },
      { key: "short_description", label: "Description", icon: FileText, render: () => textOrDash(s.short_description) },
      { key: "long_description", label: "Product Overview", icon: FileText, render: () => textOrDash(s.long_description) },
      { key: "website_url", label: "Company URL", icon: Globe, render: () => textOrDash(s.website_url) },
      { key: "linkedin_url", label: "LinkedIn URL", icon: Linkedin, render: () => textOrDash(s.linkedin_url) },
      { key: "product_tags", label: "Product & Service Tags", icon: Tag, render: () => joinOrDash(s.product_tags) },
      { key: "market_tags", label: "Market Tags", icon: Tag, render: () => joinOrDash(s.market_tags) },
      {
        key: "founders",
        label: "Founders",
        icon: Users,
        render: () => {
          const founders = (s.founders ?? []) as Array<{ name?: string | null }>;
          if (!founders.length) return <span className="text-muted-foreground">—</span>;
          return textOrDash(founders.map((f) => f.name).filter(Boolean).join(", "));
        },
      },
      {
        key: "investors",
        label: "Investors",
        icon: Users,
        render: () => {
          const investors = (s.related_investors ?? []) as Array<{ name: string }>;
          if (!investors.length) return <span className="text-muted-foreground">—</span>;
          return textOrDash(investors.map((i) => i.name).join(", "));
        },
      },
    ];
  }, [startup]);

  const visibleFields = showAll ? fields : fields.slice(0, INITIAL_COUNT);
  const hiddenCount = fields.length - INITIAL_COUNT;

  const toggle = (key: string) => {
    setRestrictions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    fields.forEach((f) => (next[f.key] = true));
    setRestrictions(next);
  };

  const clearAll = () => setRestrictions({});

  const handleSave = () => {
    saveRestrictionsToStorage(startup.id, restrictions);
    toast.success("Restrictions saved");
  };

  return (
    <div className="space-y-5">
      {/* Notice banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200/70 bg-amber-50/70 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">
            Control what non-authorized users can see
          </div>
          <div className="text-xs text-muted-foreground">
            Restricted fields will appear as greyed-out placeholders for unauthorized users in all views.
          </div>
        </div>
        <button type="button" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">
          Learn more
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Restrict basic startup information</h3>
              <p className="text-xs text-muted-foreground">
                Select the information you want to restrict from non-authorized users.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={selectAll}>
                <CheckSquare className="h-3.5 w-3.5" /> Select all
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={clearAll}>
                <RotateCcw className="h-3.5 w-3.5" /> Clear all
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>Information Field</div>
              <div>Current Value (Authorized Users)</div>
              <div>Restrict</div>
            </div>
            <div className="divide-y divide-border/50">
              {visibleFields.map((f) => {
                const Icon = f.icon;
                const on = !!restrictions[f.key];
                return (
                  <div
                    key={f.key}
                    className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{f.label}</span>
                    </div>
                    <div className="truncate text-foreground/80">{f.render(startup)}</div>
                    <Switch checked={on} onCheckedChange={() => toggle(f.key)} />
                  </div>
                );
              })}
            </div>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="flex w-full items-center justify-center gap-1 border-t border-border/60 bg-muted/20 py-2 text-xs font-medium text-primary hover:bg-muted/40"
              >
                {showAll ? (
                  <>
                    Show fewer fields <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Show more fields ({hiddenCount}) <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-border/60 bg-card p-5">
          <div className="mb-3 text-sm font-semibold">How it works</div>
          <ul className="space-y-3 text-xs text-muted-foreground">
            <li>
              <div className="font-medium text-foreground">Greyed-out placeholders</div>
              Non-authorized users will see grey bars instead of actual values.
            </li>
            <li>
              <div className="font-medium text-foreground">Data stays protected</div>
              Restricted data is never shared, exported, or exposed in search results.
            </li>
            <li>
              <div className="font-medium text-foreground">Applies everywhere</div>
              Restrictions apply to Grid, List, Split view, details, exports, shared links, and more.
            </li>
            <li className="rounded-md bg-blue-50/60 p-2 dark:bg-blue-950/20">
              <div className="font-medium text-foreground">Authorized users</div>
              You and users with access will continue to see the actual information.
            </li>
          </ul>
        </aside>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Lock className="h-4 w-4" /> Save restrictions
        </Button>
      </div>
    </div>
  );
}
