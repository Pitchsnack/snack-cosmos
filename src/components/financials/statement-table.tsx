import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { EMPTY, fmtAmount, fmtNumber, type StatementRowDef } from "@/lib/financials";
import type { StatementItem } from "@/lib/financials.functions";

const HEAD = "bg-[hsl(222_47%_23%)] text-white";

export function StatementTable({
  years,
  rows,
  items,
  sections,
}: {
  years: number[];
  rows?: StatementRowDef[];
  items: StatementItem[];
  /** Optional grouped layout (cash flow). */
  sections?: { title: string; rows: StatementRowDef[] }[];
}) {
  const byKey = new Map<string, StatementItem>();
  for (const it of items) byKey.set(`${it.item_code}:${it.fiscal_year}`, it);

  const groups = sections ?? [{ title: "", rows: rows ?? [] }];
  const colCount = years.length * 2 + 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className={cn("sticky left-0 z-10 w-[300px] px-4 py-3 text-left font-semibold", HEAD)}
            >
              Unit : Baht
            </th>
            {years.map((y) => (
              <th
                key={y}
                colSpan={2}
                className={cn("border-l border-white/15 px-4 py-2 text-center font-semibold", HEAD)}
              >
                {y}
              </th>
            ))}
          </tr>
          <tr>
            {years.map((y) => (
              <Fragment key={y}>
                <th className={cn("border-l border-white/15 px-4 py-2 text-center text-xs font-medium", HEAD)}>
                  Amount
                </th>
                <th className={cn("border-l border-white/15 px-4 py-2 text-center text-xs font-medium", HEAD)}>
                  %Change
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.title || "all"}>
              {group.title && (
                <tr>
                  <td
                    colSpan={colCount}
                    className={cn("px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide", HEAD)}
                  >
                    {group.title}
                  </td>
                </tr>
              )}
              {group.rows.map((row) => (
                <tr key={row.code} className="border-t border-border/50">
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 px-4 py-2.5 text-left font-normal",
                      HEAD,
                      row.isTotal && "font-semibold",
                    )}
                  >
                    {row.label}
                  </th>
                  {years.map((y) => {
                    const it = byKey.get(`${row.code}:${y}`);
                    return (
                      <Fragment key={y}>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right tabular-nums",
                            row.isTotal && "font-semibold",
                          )}
                        >
                          {it ? fmtAmount(it.amount) : EMPTY}
                        </td>
                        <td className="border-l border-border/40 px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {it && it.percent_change !== null ? fmtNumber(it.percent_change) : EMPTY}
                        </td>
                      </Fragment>
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
