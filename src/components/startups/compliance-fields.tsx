/**
 * Edit Startup inputs for Regulatory Licenses and International Standards.
 * Values live on the startup record itself (same pattern as the tag fields).
 */

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISO_STANDARDS,
  LICENCE_CATEGORIES,
  SEED_LICENCES,
  normaliseLicenceName,
  sortLicences,
  validateLicence,
  type LicenceCategory,
  type RegulatoryLicence,
} from "@/lib/compliance";
import { listLicenceSuggestions } from "@/lib/startups.functions";

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
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [iso, setIso] = useState<string>("");
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: recorded = [] } = useQuery({
    queryKey: ["licence-suggestions", category],
    queryFn: () => listLicenceSuggestions({ data: { category } }),
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const s of recorded) map.set(s.name.toLowerCase(), s);
    for (const seed of SEED_LICENCES[category])
      if (!map.has(seed.toLowerCase())) map.set(seed.toLowerCase(), { name: seed, count: 0 });
    const typed = normaliseLicenceName(name).toLowerCase();
    return [...map.values()]
      .filter((s) => !typed || s.name.toLowerCase().includes(typed))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [recorded, category, name]);

  const typed = normaliseLicenceName(name);
  const exactMatch = suggestions.some((s) => s.name.toLowerCase() === typed.toLowerCase());
  const showSuggestions = focused && typed.length > 0;

  const addLicence = (licenceName: string) => {
    const clean = normaliseLicenceName(licenceName);
    const err = validateLicence(category, clean, licences);
    if (err) {
      toast.error(err);
      return;
    }
    onLicencesChange([...licences, { category, name: clean, number: number.trim() || null }]);
    setName("");
    setNumber("");
  };

  const addIso = () => {
    if (!iso || isoStandards.includes(iso)) return;
    onIsoChange([...isoStandards, iso]);
    setIso("");
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

        <div className="grid grid-cols-[150px_1fr_160px_78px] gap-[9px]">
          <Select value={category} onValueChange={(v) => setCategory(v as LicenceCategory)}>
            <SelectTrigger className="bg-white">
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
          <Input
            value={name}
            maxLength={160}
            placeholder="Licence name, e.g. BOT — e-Money Licence"
            className="bg-white"
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 150);
            }}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLicence(name);
              }
            }}
          />
          <Input
            value={number}
            maxLength={120}
            placeholder="Licence no. (optional)"
            className="bg-white"
            onChange={(e) => setNumber(e.target.value)}
          />
          <Button type="button" onClick={() => addLicence(name)}>
            Add
          </Button>
        </div>

        {showSuggestions && (
          <div className="mt-2 overflow-hidden rounded-[9px] border bg-white" style={{ borderColor: "#D7DBE2" }}>
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addLicence(s.name)}
                className="block w-full border-b px-3 py-2 text-left text-[12.5px] last:border-b-0 hover:bg-[#EFF4FE]"
                style={{ borderColor: "#EFF1F4", color: "#1D4ED8" }}
              >
                {s.name}{" "}
                <span className="text-[#9AA3AF]">
                  {s.count > 0
                    ? `· used by ${s.count} startup${s.count === 1 ? "" : "s"}`
                    : "· suggested"}
                </span>
              </button>
            ))}
            {!exactMatch && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addLicence(typed)}
                className="block w-full px-3 py-2 text-left text-[12.5px] italic text-muted-foreground hover:bg-muted/50"
              >
                + Add &quot;{typed}&quot; as a new licence under {category}
              </button>
            )}
          </div>
        )}
      </div>

      {/* International Standards (ISO) — normal form section */}
      <div className="space-y-1.5">
        <Label>International Standards (ISO) ({isoStandards.length})</Label>
        {isoStandards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {isoStandards.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onIsoChange(isoStandards.filter((x) => x !== s))}
                className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground"
              >
                {s} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Select value={iso} onValueChange={setIso}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a standard" />
            </SelectTrigger>
            <SelectContent>
              {ISO_STANDARDS.filter((s) => !isoStandards.includes(s)).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={addIso} disabled={!iso}>
            Add
          </Button>
        </div>
      </div>
    </>
  );
}
