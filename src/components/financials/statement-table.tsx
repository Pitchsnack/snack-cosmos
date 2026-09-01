import { cn } from "@/lib/utils";
import { EMPTY, fmtAmount, fmtNumber, type StatementRowDef } from "@/lib/financials";
import type { StatementItem } from "@/lib/financials.functions";

export function StatementTable({
  years,
  rows,
  items,
}: {
  years: number[];
  rows: StatementRowDef[];
  items: StatementItem[];
}) {
  const byKey = new Map<string, StatementItem>();
  for (const it of items) byKey.set(`${it.item_code}:${it.fiscal_year}`, it);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-10 w-[280px] border-r border-white/10 bg-[hsl(222_47%_23%)] px-4 py-3 text-left font-semibold text-white"
            >
              Unit : Baht
            </th>
            {years.map((y) => (
              <th
                key={y}
                colSpan={2}
                className="border-l border-white/10 bg-[hsl(222_47%_23%)] px-4 py-2 text-center font-semibold text-white"
              >
                {y}
              </th>
            ))}
          </tr>
          <tr>
            {years.map((y) => (
              <>
                <th
                  key={`${y}-a`}
                  className="border-l border-white/10 bg-[hsl(222_47%_23%)] px-4 py-2 text-center text-xs font-medium text-white/90"
                >
                  Amount
                </th>
                <th
                  key={`${y}-c`}
                  className="border-l border-white/10 bg-[hsl(222_47%_23%)] px-4 py-2 text-center text-xs font-medium text-white/90"
                >
                  %Change
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-t border-border/50">
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 bg-[hsl(222_47%_23%)] px-4 py-2.5 text-left font-normal text-white",
                  row.isTotal && "font-semibold",
                )}
              >
                {row.label}
              </th>
              {years.map((y) => {
                const it = byKey.get(`${row.code}:${y}`);
                return (
                  <>
                    <td
                      key={`${row.code}-${y}-a`}
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        row.isTotal && "font-semibold",
                      )}
                    >
                      {it ? fmtAmount(it.amount) : EMPTY}
                    </td>
                    <td
                      key={`${row.code}-${y}-c`}
                      className="border-l border-border/40 px-4 py-2.5 text-right tabular-nums text-muted-foreground"
                    >
                      {it && it.percent_change !== null ? fmtNumber(it.percent_change) : EMPTY}
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
