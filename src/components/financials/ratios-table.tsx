import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { EMPTY, RATIO_GROUPS, fmtNumber } from "@/lib/financials";
import type { RatioItem } from "@/lib/financials.functions";

const HEAD = "bg-[hsl(222_47%_23%)] text-white";

export function RatiosTable({ years, ratios }: { years: number[]; ratios: RatioItem[] }) {
  const byKey = new Map<string, RatioItem>();
  for (const r of ratios) byKey.set(`${r.ratio_code}:${r.fiscal_year}`, r);

  let index = 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr>
            <th className={cn("w-16 px-4 py-3 text-center font-semibold", HEAD)}>No.</th>
            <th className={cn("border-l border-white/15 px-4 py-3 text-center font-semibold", HEAD)}>
              Ratios
            </th>
            {years.map((y) => (
              <th
                key={y}
                className={cn("w-32 border-l border-white/15 px-4 py-3 text-center font-semibold", HEAD)}
              >
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RATIO_GROUPS.map((group) => (
            <Fragment key={group.category}>
              <tr>
                <td colSpan={years.length + 2} className={cn("px-4 py-2 text-center font-semibold", HEAD)}>
                  {group.title}
                </td>
              </tr>
              {group.rows.map((row) => {
                index += 1;
                return (
                  <tr key={row.code} className="border-t border-border/50">
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{index}</td>
                    <td className="border-l border-border/40 px-4 py-2.5">{row.label}</td>
                    {years.map((y) => {
                      const r = byKey.get(`${row.code}:${y}`);
                      return (
                        <td
                          key={y}
                          className="border-l border-border/40 px-4 py-2.5 text-right tabular-nums"
                        >
                          {r && r.value !== null ? fmtNumber(r.value) : EMPTY}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
