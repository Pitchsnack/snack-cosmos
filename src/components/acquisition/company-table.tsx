import { Fragment } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompetitorReference, TargetCompany } from "@/lib/acquisition/strategy-store";

export type CompanyRowItem = TargetCompany | CompetitorReference;

/** One-line supporting description shown under the company name. */
function shortLine(item: CompanyRowItem): string {
  const snapshot = item.linkedSnapshot?.shortDescription?.trim();
  if (snapshot) return snapshot;
  const note = item.notes?.split("\n")[0]?.trim();
  if (note) return note;
  const tags = item.linkedSnapshot?.industry ?? [];
  return tags.join(", ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Shared, compact company table used identically by Target Companies and
 * Competitor References so both sections stay visually consistent.
 */
export function CompanyTable({
  items,
  canEdit,
  onEdit,
  onDelete,
  onOpenLinked,
  renderExtra,
}: {
  items: CompanyRowItem[];
  canEdit: boolean;
  onEdit: (item: never) => void;
  onDelete: (item: never) => void;
  onOpenLinked?: (startupId: string) => void;
  /** Optional trailing content rendered below a row (e.g. extraction results). */
  renderExtra?: (item: CompanyRowItem) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[14%]" />
          <col className="w-[42%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Company Name</th>
            <th className="pb-2 pr-4 font-medium">Website</th>
            <th className="pb-2 pr-4 font-medium">Why Attractive</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const line = shortLine(item);
            const extra = renderExtra?.(item);
            return (
              <Fragment key={item.id}>
                <tr className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4 align-middle">
                    <div className="flex items-center gap-2.5">
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt={`${item.name} logo`}
                          className="h-8 w-8 shrink-0 rounded-md border border-border/60 bg-background object-contain"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-primary/10 text-[11px] font-semibold text-primary">
                          {initials(item.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.linkedStartupId ? (
                            <button
                              type="button"
                              onClick={() => onOpenLinked?.(item.linkedStartupId!)}
                              className="truncate font-medium text-blue-900 hover:underline"
                              title="View the linked startup record"
                            >
                              {item.name}
                            </button>
                          ) : (
                            <span className="truncate font-medium">{item.name}</span>
                          )}
                          {item.linkedStartupId && (
                            <button
                              type="button"
                              onClick={() => onOpenLinked?.(item.linkedStartupId!)}
                              title="View the linked startup record"
                              className="shrink-0 rounded-full border border-primary/25 bg-primary/5 px-1.5 py-px text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              Linked
                            </button>
                          )}
                        </div>
                        {line && (
                          <div className="truncate text-xs text-muted-foreground">{line}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    {item.website ? (
                      <a
                        href={
                          /^https?:\/\//i.test(item.website) ? item.website : `https://${item.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-900 hover:underline"
                      >
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 align-middle">
                    {item.attractiveKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.attractiveKeywords.map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 align-middle text-right">
                    {canEdit ? (
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onEdit(item as never)}
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(item as never)}
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                {extra && (
                  <tr className="border-b border-border/40 last:border-0">
                    <td colSpan={4} className="pb-4">
                      {extra}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
