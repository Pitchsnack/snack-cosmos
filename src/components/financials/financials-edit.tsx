import { Fragment, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CASH_FLOW_SECTIONS,
  INCOME_ROWS,
  POSITION_ROWS,
  RATIO_GROUPS,
  type StatementRowDef,
} from "@/lib/financials";
import {
  autoEnrichFinancials,
  saveStartupFinancials,
  type CompanyProfileDraft,
  type FinancialYearDraft,
} from "@/lib/financials-edit.functions";
import type { StartupFinancials } from "@/lib/financials.functions";
import { ButtonSpinner } from "@/components/ui/PitchSnackLoader";

type Group = "income" | "position" | "cashFlow" | "ratios";

const PROFILE_FIELDS: { key: keyof CompanyProfileDraft; label: string; placeholder: string }[] = [
  { key: "registeredType", label: "Registered Type", placeholder: "Company Limited" },
  { key: "status", label: "Status", placeholder: "Operating" },
  { key: "registeredDate", label: "Registered Date", placeholder: "30 Apr 2024" },
  { key: "registeredCapital", label: "Registered Capital", placeholder: "2,000,000.00 Baht" },
  { key: "businessSize", label: "Business Size", placeholder: "S" },
];

interface Provenance {
  source?: string | null;
  sourceReference?: string | null;
  matchedRegisteredNumber?: string | null;
  matchedRegisteredName?: string | null;
  retrievedAt?: string | null;
}

const RATIO_ROWS = RATIO_GROUPS.flatMap((g) => g.rows);
const CASH_FLOW_ROWS = CASH_FLOW_SECTIONS.flatMap((s) => s.rows);

function toDraft(data: StartupFinancials): FinancialYearDraft[] {
  const byYear = new Map<number, FinancialYearDraft>();
  for (const year of data.years) {
    byYear.set(year, {
      fiscalYear: year,
      currency: data.statements.find((s) => s.fiscal_year === year)?.currency ?? data.currency,
      sourceName: data.statements.find((s) => s.fiscal_year === year)?.source_name ?? null,
      income: {},
      position: {},
      cashFlow: {},
      ratios: {},
    });
  }
  const fill = (items: { fiscal_year: number; item_code: string; amount: number | null }[], g: Group) => {
    for (const it of items) {
      const y = byYear.get(it.fiscal_year);
      if (y) (y[g] as Record<string, number | null>)[it.item_code] = it.amount;
    }
  };
  fill(data.income, "income");
  fill(data.position, "position");
  fill(data.cashFlow, "cashFlow");
  for (const r of data.ratios) {
    const y = byYear.get(r.fiscal_year);
    if (y) y.ratios[r.ratio_code] = r.value;
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

/**
 * Editable financial workspace. Every supported field is always shown, empty
 * values stay visibly empty, and nothing is written until the user saves.
 */
export function FinancialsEdit({
  startupId,
  data,
  onCancel,
  onSaved,
}: {
  startupId: string;
  data: StartupFinancials;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const enrich = useServerFn(autoEnrichFinancials);
  const save = useServerFn(saveStartupFinancials);

  const [years, setYears] = useState<FinancialYearDraft[]>(() => toDraft(data));
  const [removedYears, setRemovedYears] = useState<number[]>([]);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [enrichedKeys, setEnrichedKeys] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("income");
  const [profile, setProfile] = useState<CompanyProfileDraft>(() => ({
    registeredType: data.profile.registeredType,
    status: data.profile.status,
    registeredDate: data.profile.registeredDate,
    registeredCapital: data.profile.registeredCapital,
    businessSize: data.profile.businessSize,
  }));
  const [enrichedProfileKeys, setEnrichedProfileKeys] = useState<Set<string>>(new Set());

  /**
   * Raw keystrokes per cell. Kept alongside the parsed numbers so partial input
   * ("-", "1.", "-0.") survives typing instead of being reverted by the
   * controlled input.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setValue = (fiscalYear: number, group: Group, code: string, raw: string) => {
    const key = `${fiscalYear}:${group}:${code}`;
    const trimmed = raw.trim();
    // Allow only numeric-ish input, including in-progress values.
    if (trimmed !== "" && !/^-?[\d,]*\.?\d*$/.test(trimmed)) return;
    setDrafts((prev) => ({ ...prev, [key]: raw }));

    const parsed = trimmed === "" ? null : Number(trimmed.replace(/,/g, ""));
    if (parsed !== null && !Number.isFinite(parsed)) return; // "-" / "." — keep text, no value yet
    setYears((prev) =>
      prev.map((y) =>
        y.fiscalYear === fiscalYear
          ? { ...y, [group]: { ...(y[group] as Record<string, number | null>), [code]: parsed } }
          : y,
      ),
    );
    setEnrichedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };


  const addYear = () => {
    const next = years.length ? Math.max(...years.map((y) => y.fiscalYear)) + 1 : new Date().getFullYear();
    if (years.some((y) => y.fiscalYear === next)) return;
    setYears((prev) =>
      [
        ...prev,
        {
          fiscalYear: next,
          currency: data.currency || "THB",
          sourceName: null,
          income: {},
          position: {},
          cashFlow: {},
          ratios: {},
        },
      ].sort((a, b) => a.fiscalYear - b.fiscalYear),
    );
  };

  const removeYear = (fiscalYear: number) => {
    setYears((prev) => prev.filter((y) => y.fiscalYear !== fiscalYear));
    if (data.years.includes(fiscalYear)) setRemovedYears((prev) => [...prev, fiscalYear]);
  };

  const enrichMutation = useMutation({
    mutationFn: () => enrich({ data: { startupId } }),
    onSuccess: (result) => {
      // The Company Profile block is applied whenever the company was matched,
      // even when no financial statements were published.
      if (result.profile) {
        const incoming = result.profile;
        const touchedProfile = new Set<string>();
        setProfile((prev) => {
          const next = { ...prev };
          for (const { key } of PROFILE_FIELDS) {
            const value = incoming[key];
            if (value && value.trim()) {
              next[key] = value.trim();
              touchedProfile.add(key);
            }
          }
          return next;
        });
        setEnrichedProfileKeys(touchedProfile);
      }
      if (result.status !== "ok" || !result.years?.length) {
        toast.error(result.message ?? "Auto Enrich returned no data.");
        return;
      }
      setDrafts({}); // proposed values replace any in-progress text
      const touched = new Set<string>();
      setYears((prev) => {
        const map = new Map(prev.map((y) => [y.fiscalYear, y]));
        for (const incoming of result.years!) {
          const existing = map.get(incoming.fiscalYear) ?? {
            fiscalYear: incoming.fiscalYear,
            currency: incoming.currency,
            sourceName: incoming.sourceName ?? null,
            income: {},
            position: {},
            cashFlow: {},
            ratios: {},
          };
          const merged: FinancialYearDraft = {
            ...existing,
            currency: incoming.currency || existing.currency,
            sourceName: incoming.sourceName ?? existing.sourceName ?? null,
            income: { ...existing.income },
            position: { ...existing.position },
            cashFlow: { ...existing.cashFlow },
            ratios: { ...existing.ratios },
          };
          for (const group of ["income", "position", "cashFlow", "ratios"] as Group[]) {
            const src = incoming[group] as Record<string, number | null>;
            for (const [code, value] of Object.entries(src)) {
              if (value === null || value === undefined) continue;
              (merged[group] as Record<string, number | null>)[code] = value;
              touched.add(`${incoming.fiscalYear}:${group}:${code}`);
            }
          }
          map.set(incoming.fiscalYear, merged);
        }
        return [...map.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
      });
      setEnrichedKeys(touched);
      setProvenance({
        source: "DBD_DATA_WAREHOUSE",
        sourceReference: result.sourceReference ?? null,
        matchedRegisteredNumber: result.matchedRegisteredNumber ?? null,
        matchedRegisteredName: result.matchedRegisteredName ?? null,
        retrievedAt: result.retrievedAt ?? null,
      });
      toast.success(
        `Auto Enrich proposed ${touched.size} value${touched.size === 1 ? "" : "s"} — review and Save to keep them.`,
      );
      (result.warnings ?? []).forEach((w) => toast.warning(w));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          startupId,
          years,
          removedYears,
          profile,
          provenance: provenance
            ? {
                source: provenance.source ?? null,
                sourceReference: provenance.sourceReference ?? null,
                matchedRegisteredNumber: provenance.matchedRegisteredNumber ?? null,
                matchedRegisteredName: provenance.matchedRegisteredName ?? null,
                retrievedAt: provenance.retrievedAt ?? null,
              }
            : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Financial data saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sections = useMemo(
    () => ({
      income: [{ title: null as string | null, rows: INCOME_ROWS }],
      position: [{ title: null as string | null, rows: POSITION_ROWS }],
      cashFlow: CASH_FLOW_SECTIONS.map((s) => ({ title: s.title as string | null, rows: s.rows })),
      ratios: RATIO_GROUPS.map((g) => ({
        title: g.title as string | null,
        rows: g.rows as StatementRowDef[],
      })),
    }),
    [],
  );

  const busy = enrichMutation.isPending || saveMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => enrichMutation.mutate()} disabled={busy}>
            {enrichMutation.isPending ? (
              <ButtonSpinner invert={false} className="mr-1" />
            ) : (
              <Sparkles className="mr-1 h-3.5 w-3.5" />
            )}
            <span className={enrichMutation.isPending ? "ps-btn-loading__label" : undefined}>
              {enrichMutation.isPending ? "Enriching…" : "Auto Enrich"}
            </span>
          </Button>
          <span className="text-xs text-muted-foreground">
            Looks the company up in the DBD Data Warehouse. Nothing is saved until you click Save.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addYear} disabled={busy}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add fiscal year
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={busy}>
            {saveMutation.isPending ? (
              <ButtonSpinner invert={false} className="mr-1" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            <span className={saveMutation.isPending ? "ps-btn-loading__label" : undefined}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </span>
          </Button>
        </div>
      </div>

      {provenance && (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Proposed from <span className="font-medium">DBD Data Warehouse</span>
          {provenance.matchedRegisteredName ? ` · ${provenance.matchedRegisteredName}` : ""}
          {provenance.matchedRegisteredNumber ? ` · ${provenance.matchedRegisteredNumber}` : ""}
          {provenance.retrievedAt
            ? ` · retrieved ${new Date(provenance.retrievedAt).toLocaleString()}`
            : ""}
          . Highlighted cells are proposed edits — review before saving.
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
          <h3 className="text-sm font-semibold">Company Profile</h3>
          <span className="text-xs text-muted-foreground">
            Extracted from the DBD company profile page — editable.
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILE_FIELDS.map(({ key, label, placeholder }) => {
            const enriched = enrichedProfileKeys.has(key);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={`p-${key}`}>
                    {label}
                  </label>
                  {enriched && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      DBD
                    </Badge>
                  )}
                </div>
                <Input
                  id={`p-${key}`}
                  value={profile[key] ?? ""}
                  placeholder={placeholder}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProfile((prev) => ({ ...prev, [key]: value === "" ? null : value }));
                    setEnrichedProfileKeys((prev) => {
                      const next = new Set(prev);
                      next.delete(key);
                      return next;
                    });
                  }}
                  className={`h-9 ${enriched ? "border-primary/60 bg-primary/5" : ""}`}
                />
              </div>
            );
          })}
        </div>
      </div>



      {years.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No fiscal years yet. Add a fiscal year or run Auto Enrich.
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="income">Income Statement</TabsTrigger>
            <TabsTrigger value="position">Financial Position</TabsTrigger>
            <TabsTrigger value="cashFlow">Cash Flow Statement</TabsTrigger>
            <TabsTrigger value="ratios">Financial Ratios</TabsTrigger>
          </TabsList>
          {(["income", "position", "cashFlow", "ratios"] as Group[]).map((group) => (
            <TabsContent key={group} value={group} className="mt-4">
              <EditTable
                group={group}
                sections={sections[group]}
                years={years}
                enrichedKeys={enrichedKeys}
                drafts={drafts}
                onChange={setValue}
                onRemoveYear={removeYear}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function EditTable({
  group,
  sections,
  years,
  enrichedKeys,
  drafts,
  onChange,
  onRemoveYear,
}: {
  group: Group;
  sections: { title: string | null; rows: StatementRowDef[] }[];
  years: FinancialYearDraft[];
  enrichedKeys: Set<string>;
  drafts: Record<string, string>;
  onChange: (fiscalYear: number, group: Group, code: string, value: string) => void;
  onRemoveYear: (fiscalYear: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Item</th>
            {years.map((y) => (
              <th key={y.fiscalYear} className="px-3 py-2 text-right font-medium">
                <div className="flex items-center justify-end gap-1">
                  {y.fiscalYear}
                  {group === "income" && (
                    <button
                      type="button"
                      aria-label={`Remove fiscal year ${y.fiscalYear}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveYear(y.fiscalYear)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.title ?? "main"}>
              {section.title && (
                <tr className="bg-muted/30">
                  <td
                    colSpan={years.length + 1}
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {section.title}
                  </td>
                </tr>
              )}
              {section.rows.map((row) => (
                <tr key={row.code} className="border-t border-border/60">
                  <td className={`px-3 py-1.5 ${row.isTotal ? "font-semibold" : ""}`}>
                    {row.label}
                  </td>
                  {years.map((y) => {
                    const cellKey = `${y.fiscalYear}:${group}:${row.code}`;
                    const value = (y[group] as Record<string, number | null>)[row.code];
                    const enriched = enrichedKeys.has(cellKey);
                    // Show the user's in-progress text ("-", "1.") verbatim.
                    const text =
                      drafts[cellKey] ?? (value === null || value === undefined ? "" : String(value));
                    return (
                      <td key={y.fiscalYear} className="px-2 py-1">
                        <div className="flex items-center justify-end gap-1">
                          {enriched && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                              DBD
                            </Badge>
                          )}
                          <Input
                            inputMode="decimal"
                            value={text}
                            placeholder=""
                            onChange={(e) => onChange(y.fiscalYear, group, row.code, e.target.value)}
                            className={`h-8 w-32 text-right ${enriched ? "border-primary/60 bg-primary/5" : ""}`}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
