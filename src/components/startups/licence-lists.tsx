import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/components/common/edit-info-popup";
import { WIZARD_ISO, WIZARD_LICENCES } from "@/lib/seller-wizard";
import type { RegulatoryLicence } from "@/lib/compliance";
import { cn } from "@/lib/utils";

/**
 * Edit information › Licenses: the same two lists as the seller wizard's
 * "Licences and certifications", saved on the business as Regulatory Licenses
 * and International Standards (ISO), so both places show the same ticks.
 */
export function LicenceLists({ licences, onLicences, iso, onIso }: {
  licences: RegulatoryLicence[]; onLicences: (v: RegulatoryLicence[]) => void; iso: string[]; onIso: (v: string[]) => void;
}) {
  const tr = useTr();
  const allLic = [...WIZARD_LICENCES, ...licences.filter((l) => !WIZARD_LICENCES.some((w) => w.name === l.name))];
  const allIso = [...WIZARD_ISO, ...iso.filter((x) => !WIZARD_ISO.includes(x))];
  return (
    <div className="space-y-[14px]">
      <Box title={tr("Regulatory Licenses", "ใบอนุญาตจากหน่วยงานกำกับดูแล")} other={tr("Other licence", "ใบอนุญาตอื่น")}
        options={allLic.map((l) => l.name)} isOn={(n) => licences.some((x) => x.name === n)}
        toggle={(n) => {
          const on = licences.some((x) => x.name === n);
          if (on) onLicences(licences.filter((x) => x.name !== n));
          else onLicences([...licences, allLic.find((l) => l.name === n)!]);
        }}
        add={(n) => { if (!licences.some((x) => x.name.toLowerCase() === n.toLowerCase())) onLicences([...licences, { category: "Business", name: n }]); }} />
      <Box title={tr("International Standards (ISO)", "มาตรฐานสากล (ISO)")} other={tr("Other standard", "มาตรฐานอื่น")}
        options={allIso} isOn={(n) => iso.includes(n)}
        toggle={(n) => onIso(iso.includes(n) ? iso.filter((x) => x !== n) : [...iso, n])}
        add={(n) => { if (!iso.some((x) => x.toLowerCase() === n.toLowerCase())) onIso([...iso, n]); }} />
    </div>
  );
}

function Box({ title, other, options, isOn, toggle, add }: {
  title: string; other: string; options: string[]; isOn: (n: string) => boolean; toggle: (n: string) => void; add: (n: string) => void;
}) {
  const tr = useTr();
  const [draft, setDraft] = useState("");
  const commit = () => { const n = draft.trim(); if (!n) return; add(n); setDraft(""); };
  return (
    <div className="rounded-[10px] border border-[#E6E8EC] px-4 py-[14px] dark:border-border">
      <div className="text-[13.5px] font-semibold">{title} <span className="font-normal text-[#6A7181]">{tr("(optional)", "(ไม่บังคับ)")}</span></div>
      <div className="mt-[10px] flex flex-wrap gap-2">
        {options.map((n) => {
          const on = isOn(n);
          return (
            <button key={n} type="button" aria-pressed={on} onClick={() => toggle(n)}
              className={cn("inline-flex h-7 items-center rounded-full border px-[11px] text-[12.5px]",
                on ? "border-[#F6A823] bg-[#FEF3DE] font-semibold text-[#8A4B06]" : "border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563] dark:border-border dark:bg-muted dark:text-muted-foreground")}>
              {on && <Check className="mr-[5px] h-[13px] w-[13px]" />}{n}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={draft} placeholder={other} maxLength={160} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={commit}>Add</Button>
      </div>
    </div>
  );
}
