import { Label } from "@/components/ui/label";

/** Investor company size (employees). One field for the buyer's Edit profile, Review & complete and Admin's Edit Investor. */
export const COMPANY_SIZE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

export function CompanySizeField({ id = "f-company_size_band", value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Company size (employees)</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
        <option value="">Not set</option>
        {COMPANY_SIZE_BANDS.map((v) => <option key={v} value={v}>{v === "500+" ? "More than 500" : v.replace("-", "–")}</option>)}
      </select>
    </div>
  );
}
