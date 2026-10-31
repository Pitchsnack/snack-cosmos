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
      <table className="w-max min-w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className={cn("sticky left-0 z-10 min-w-[240px] p-[10px] text-left font-semibold", HEAD)}
            >
              Unit : Baht
            </th>
            {years.map((y) => (
              <th
                key={y}
                colSpan={2}
                className={cn("border-l border-white/15 p-[10px] text-center text-[13px] font-bold", HEAD)}
              >
                {y}
              </th>
            ))}
          </tr>
          <tr>
            {years.map((y) => (
              <Fragment key={y}>
                <th className={cn("whitespace-nowrap border-l border-white/15 p-[10px] text-right text-[12px] font-medium", HEAD)}>
                  Amount
                </th>
                <th className={cn("whitespace-nowrap border-l border-white/15 p-[10px] text-right text-[12px] font-medium", HEAD)}>
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
                      "sticky left-0 z-10 p-[10px] text-left font-normal",
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
                            "h-10 whitespace-nowrap p-[10px] text-right text-[13px] tabular-nums",
                            row.isTotal && "font-bold",
                          )}
                        >
                          {it ? fmtAmount(it.amount) : EMPTY}
                        </td>
                        <td className="whitespace-nowrap border-l border-border/40 p-[10px] text-right text-[12px] tabular-nums text-muted-foreground">
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
