import { decadeOf, exactMoney, moneyRange, staffRange, type EntryFacts, type HiddenProfileRow } from "@/lib/hidden-profile";
import { Marker, type MarkerKind } from "./bits";

export function CompareTab({
  facts,
  row,
  industry,
  showMarkers,
  s,
}: {
  facts: EntryFacts | undefined;
  row: HiddenProfileRow | null;
  industry: string;
  showMarkers: boolean;
  s: { company_type?: string | null; market_tags?: string[]; product_tags?: string[]; short_description?: string | null };
}) {
  const f = facts ?? ({} as EntryFacts);
  const h = row;
  const dash = "—";
  const rows: [string, string, string, MarkerKind][] = [
    ["Name", f.startup_name ?? dash, h?.code_name ?? dash, "own"],
    ["Logo and images", "Logo, company photos", "Sector image", "own"],
    ["Ref no.", h?.ref_no ?? dash, h?.ref_no ?? dash, "shared"],
    ["Type and industry", `${s.company_type ?? dash} · ${industry}`, "The same", "shared"],
    ["Founded", f.year_founded ? String(f.year_founded) : dash, decadeOf(f.year_founded) ?? dash, "range"],
    ["Location", [f.city, f.headquarters].filter(Boolean).join(", ") || dash, h?.region ?? dash, "range"],
    ["Markets", (s.market_tags ?? []).join(" · ") || dash, "The same", "shared"],
    ["Employees", f.company_size ?? dash, staffRange(f.company_size) ?? dash, "range"],
    ["Revenue", exactMoney(f.last_year_revenue) ?? dash, moneyRange(f.last_year_revenue) ?? dash, "range"],
    ["EBITDA", "From financials", "Range", "range"],
    ["Description", s.short_description ? "Directory description" : dash, h?.description ? "Anonymous description" : dash, "own"],
    ["Headline and highlights", "Written for buyers", "The same", "shared"],
    ["Product overview", "Shown", "Hidden until NDA", "nda"],
    ["Product & service tags", (s.product_tags ?? []).join(", ") || dash, "The same", "shared"],
    ["Website, email, LinkedIn", "Shown", "Hidden until NDA", "nda"],
    ["Address", "Shown", "Hidden until NDA", "nda"],
    ["People", "Names and roles", "Roles only", "own"],
    ["Customers", "Named", "Described without names", "own"],
    ["Deal terms", "Asking price, stake, deal type, reason", "The same", "shared"],
    ["Data room", "Documents", "Hidden until NDA", "nda"],
  ];
  const groups: { title: string; kinds: MarkerKind[]; note: string }[] = [
    { title: "Full profile only", kinds: ["nda"], note: "Hidden until the NDA" },
    { title: "Shared", kinds: ["shared", "range"], note: "Stored once, shown in both" },
    { title: "Hidden profile only", kinds: ["own"], note: "Written for buyers" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="rounded-lg border border-border p-3">
            <div className="text-sm font-semibold">{g.title}</div>
            <div className="text-[11px] text-muted-foreground">{g.note}</div>
            <div className="mt-2 text-xs text-muted-foreground">{rows.filter((r) => g.kinds.includes(r[3])).map((r) => r[0]).join(", ")}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Full profile</th><th className="px-3 py-2">Hidden profile</th><th className="px-3 py-2">Stored</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b, m]) => (
              <tr key={k} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{k}</td>
                <td className="px-3 py-2 text-muted-foreground">{a}</td>
                <td className="px-3 py-2 text-muted-foreground">{b}</td>
                <td className="px-3 py-2"><Marker kind={m} labelled show={showMarkers || true} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">Where it's stored</div>
        The full profile and the shared company fields stay on the directory entry. The hidden profile (code name, sector image, region, headline, description, highlights, customers, deal terms, NDA approver and the published copy buyers read) is stored separately, one per entry. Ranges, the "about N%" margin and the decade founded are worked out from the exact values and never stored.
      </div>
    </div>
  );
}
