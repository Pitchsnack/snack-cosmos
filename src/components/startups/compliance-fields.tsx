/**
 * Edit Startup inputs for Regulatory Licenses and International Standards.
 * Values live on the startup record itself (same pattern as the tag fields).
 * Both name fields use the one shared SuggestCombobox control.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuggestCombobox, type ComboOption } from "@/components/ui/suggest-combobox";
import {
  ISO_STANDARDS,
  ISO_SUBJECTS,
  LICENCE_CATEGORIES,
  SEED_LICENCES,
  normaliseLicenceName,
  normaliseStandard,
  sortLicences,
  validateLicence,
  validateStandard,
  type LicenceCategory,
  type RegulatoryLicence,
} from "@/lib/compliance";
import { listIsoSuggestions, listLicenceSuggestions } from "@/lib/startups.functions";

export function ComplianceFields({
  licences,
  onLicencesChange,
  isoStandards,
  onIsoChange,
}: {
  licences: RegulatoryLicence[];
  onLicencesChange: (v: RegulatoryLicence[]) => void;
  isoStandards: string[];
  onIsoChange: (v: string[]) => void;
}) {
  const [category, setCategory] = useState<LicenceCategory>("Financial");
  const [number, setNumber] = useState("");
  const [freshIso, setFreshIso] = useState<string[]>([]);

  const { data: recorded = [] } = useQuery({
    queryKey: ["licence-suggestions", category],
    queryFn: () => listLicenceSuggestions({ data: { category } }),
    staleTime: 60_000,
  });

  const { data: recordedIso = [] } = useQuery({
    queryKey: ["iso-suggestions"],
    queryFn: () => listIsoSuggestions(),
    staleTime: 60_000,
  });

  const licenceOptions = useMemo<ComboOption[]>(() => {
    const map = new Map<string, ComboOption>();
    for (const s of recorded)
      map.set(s.name.toLowerCase(), {
        value: s.name,
        meta: `used by ${s.count} startup${s.count === 1 ? "" : "s"}`,
      });
    for (const seed of SEED_LICENCES[category])
      if (!map.has(seed.toLowerCase())) map.set(seed.toLowerCase(), { value: seed, meta: "suggested" });
    return [...map.values()].map((o) => ({
      ...o,
      added: licences.some(
        (l) => l.category === category && l.name.toLowerCase() === o.value.toLowerCase(),
      ),
    }));
  }, [recorded, category, licences]);

  const isoOptions = useMemo<ComboOption[]>(() => {
    const map = new Map<string, ComboOption>();
    for (const s of ISO_STANDARDS) map.set(s.toLowerCase(), { value: s, meta: ISO_SUBJECTS[s] });
    for (const s of recordedIso)
      if (!map.has(s.name.toLowerCase()))
        map.set(s.name.toLowerCase(), {
          value: s.name,
          meta: `used by ${s.count} startup${s.count === 1 ? "" : "s"}`,
        });
    return [...map.values()].map((o) => ({
      ...o,
      added: isoStandards.some((s) => s.toLowerCase() === o.value.toLowerCase()),
    }));
  }, [recordedIso, isoStandards]);

  const addLicence = (licenceName: string) => {
    const clean = normaliseLicenceName(licenceName);
    const err = validateLicence(category, clean, licences);
    if (err) {
      toast.error(err);
      return;
    }
    onLicencesChange([...licences, { category, name: clean, number: number.trim() || null }]);
    setNumber("");
  };

  const addIso = (raw: string, isNew: boolean) => {
    const clean = normaliseStandard(raw);
    const err = validateStandard(clean, isoStandards);
    if (err) {
      toast.error(err);
      return;
    }
    onIsoChange([...isoStandards, clean]);
    if (isNew) setFreshIso((f) => [...f, clean]);
  };

  return (
    <>
      {/* Regulatory Licenses — boxed container */}
      <div
        className="my-5 rounded-xl border px-5 py-[18px]"
        style={{ background: "#FAFBFC", borderColor: "#E5E7EB" }}
      >
        <div className="mb-[14px] text-[13.5px] font-semibold text-foreground">
          Regulatory Licenses
        </div>

        {licences.length > 0 && (
          <div className="mb-[9px] text-[12.5px] text-muted-foreground">
            {licences.length} added
          </div>
        )}

        {licences.length > 0 && (
          <div className="mb-[9px] flex flex-wrap gap-[7px]">
            {sortLicences(licences).map((l) => (
              <button
                key={`${l.category}-${l.name}`}
                type="button"
                title={l.number ? `${l.category} · Licence no. ${l.number}` : l.category}
                onClick={() =>
                  onLicencesChange(
                    licences.filter((x) => !(x.category === l.category && x.name === l.name)),
                  )
                }
                className="inline-flex items-center gap-[9px] rounded-full border px-[13px] py-[6px] text-[12.5px]"
                style={{ color: "#1D4ED8", backgroundColor: "#EFF4FE", borderColor: "#D3E0FB" }}
              >
                {l.name} <X className="h-3 w-3 opacity-65" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[150px_1fr_180px] items-start gap-[9px]">
          <Select value={category} onValueChange={(v) => setCategory(v as LicenceCategory)}>
            <SelectTrigger className="h-[42px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENCE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SuggestCombobox
            id="licence-name"
            options={licenceOptions}
            noun="licence"
            placeholder="Search licences…"
            onSelect={(v) => addLicence(v)}
          />
          <Input
            value={number}
            maxLength={120}
            placeholder="Licence no. (optional)"
            className="h-[42px] bg-white"
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
      </div>

      {/* International Standards (ISO) */}
      <div className="space-y-1.5">
        <Label htmlFor="iso-standard">
          International Standards (ISO) ({isoStandards.length})
        </Label>
        {isoStandards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {isoStandards.map((s) => {
              const isNew = freshIso.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onIsoChange(isoStandards.filter((x) => x !== s))}
                  className="inline-flex items-center gap-2 rounded-full border px-[13px] py-[6px] text-[12.5px]"
                  style={
                    isNew
                      ? { background: "#EAF7EE", color: "#15803D", borderColor: "#CFE8D8" }
                      : { background: "#F4F5F7", color: "#374151", borderColor: "#E5E7EB" }
                  }
                >
                  {s} <X className="h-3 w-3 opacity-65" />
                </button>
              );
            })}
          </div>
        )}
        <SuggestCombobox
          id="iso-standard"
          options={isoOptions}
          noun="standard"
          placeholder="Search standards…"
          onSelect={addIso}
        />
      </div>
    </>
  );
}
