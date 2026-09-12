/**
 * Edit Startup inputs for Regulatory Licenses and International Standards.
 * Values live on the startup record itself (same pattern as the tag fields).
 */

import { useMemo, useState } from "react";
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
  LICENCE_COLORS,
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
      {/* Regulatory Licenses */}
      <div className="space-y-1.5">
        <Label>Regulatory Licenses ({licences.length})</Label>
        {licences.length > 0 && (
          <div className="flex flex-wrap gap-[6px]">
            {sortLicences(licences).map((l) => {
              const c = LICENCE_COLORS[l.category];
              return (
                <button
                  key={`${l.category}-${l.name}`}
                  type="button"
                  title={l.number ? `${l.category} · Licence no. ${l.number}` : l.category}
                  onClick={() =>
                    onLicencesChange(
                      licences.filter((x) => !(x.category === l.category && x.name === l.name)),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-full border px-[11px] py-[5px] text-[12.5px]"
                  style={{ color: c.text, backgroundColor: c.bg, borderColor: c.border }}
                >
                  {l.name} <X className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as LicenceCategory)}>
            <SelectTrigger className="w-[150px]">
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
          <div className="relative min-w-[220px] flex-1">
            <Input
              value={name}
              maxLength={160}
              placeholder="Licence name, e.g. BOT — e-Money Licence"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLicence(name);
                }
              }}
              list="licence-suggestions"
            />
            <datalist id="licence-suggestions">
              {suggestions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.count > 0 ? `used by ${s.count} startup${s.count === 1 ? "" : "s"}` : "suggested"}
                </option>
              ))}
            </datalist>
          </div>
          <Input
            value={number}
            maxLength={120}
            placeholder="Licence no. (optional)"
            onChange={(e) => setNumber(e.target.value)}
            className="w-[160px]"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addLicence(name)}>
            Add
          </Button>
        </div>
        {typed && !exactMatch && (
          <button
            type="button"
            onClick={() => addLicence(typed)}
            className="text-xs text-primary hover:underline"
          >
            + Add &quot;{typed}&quot; as a new licence under {category}
          </button>
        )}
      </div>

      {/* International Standards (ISO) */}
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
