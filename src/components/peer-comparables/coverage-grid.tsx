/**
 * Admin coverage grid — sectors down the side, business models across.
 * It answers "which peer set should I build next": sort by Startups using.
 */

import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";

import { usePeerAvailability } from "@/hooks/use-peer-availability";
import { BUSINESS_MODELS } from "@/lib/sectors";
import { cn } from "@/lib/utils";

export function CoverageGrid() {
  const { data, isLoading } = usePeerAvailability();
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    if (!data) return [];
    const sectors = new Set<string>([
      ...data.sets.map((s) => s.sector),
      ...data.startupCounts.map((s) => s.sector),
    ]);
    return [...sectors]
      .map((sector) => {
        const inSector = data.sets.filter((s) => s.sector === sector);
        const cell = (model: string | null) =>
          inSector.find((s) => (s.businessModel ?? null) === model)?.peerCount ?? null;
        const startups = data.startupCounts.find((s) => s.sector === sector)?.count ?? 0;
        return {
          sector,
          all: cell(null),
          models: BUSINESS_MODELS.map((b) => cell(b.value)),
          startups,
          /** Startups carry this sector but nothing sector-wide covers them. */
          uncovered: startups > 0 && cell(null) === null,
        };
      })
      .sort((a, b) =>
        a.startups === b.startups
          ? a.sector.localeCompare(b.sector)
          : desc
            ? b.startups - a.startups
            : a.startups - b.startups,
      );
  }, [data, desc]);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-[hsl(222_47%_23%)] text-white">
            <th className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide">
              Sector
            </th>
            <th className="w-20 px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide">
              All
            </th>
            {BUSINESS_MODELS.map((b) => (
              <th
                key={b.value}
                className="px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide"
              >
                {b.label}
              </th>
            ))}
            <th className="w-36 px-3 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide">
              <button
                type="button"
                onClick={() => setDesc((v) => !v)}
                className="inline-flex items-center gap-1.5 uppercase hover:underline"
              >
                Startups using
                <ArrowDownUp className="h-3 w-3" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={BUSINESS_MODELS.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={BUSINESS_MODELS.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                No sectors have a peer set or a startup using them yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.sector}
              className={cn(
                "border-t border-border/50",
                r.uncovered && "bg-warning/10",
              )}
            >
              <td className="px-4 py-2.5 font-semibold text-foreground">{r.sector}</td>
              <Cell value={r.all} />
              {r.models.map((v, i) => (
                <Cell key={i} value={v} />
              ))}
              <td
                className={cn(
                  "px-3 py-2.5 text-center tabular-nums",
                  r.uncovered && "font-bold text-warning",
                )}
              >
                {r.startups}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[11.5px] text-muted-foreground">
        Rows highlighted amber have startups in that sector but no sector-wide peer set covering
        them — those are the sets worth building next.
      </p>
    </div>
  );
}

function Cell({ value }: { value: number | null }) {
  return (
    <td className="px-3 py-2.5 text-center tabular-nums">
      {value === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-semibold text-success">✓ {value}</span>
      )}
    </td>
  );
}
