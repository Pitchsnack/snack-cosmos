import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollText, RefreshCw, Eye } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  tenant_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Logs — SnackPortal2" },
      { name: "description", content: "Platform-wide audit trail." },
    ],
  }),
  component: AuditPage,
});

function actionVariant(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-success/15 text-success border-success/30";
    case "UPDATE":
      return "bg-info/15 text-info border-info/30";
    case "DELETE":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function diffFields(
  oldV: Record<string, unknown> | null,
  newV: Record<string, unknown> | null,
) {
  const keys = new Set<string>([
    ...Object.keys(oldV ?? {}),
    ...Object.keys(newV ?? {}),
  ]);
  const rows: { field: string; before: unknown; after: unknown; changed: boolean }[] = [];
  for (const k of keys) {
    const before = oldV?.[k];
    const after = newV?.[k];
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    rows.push({ field: k, before, after, changed });
  }
  rows.sort((a, b) => Number(b.changed) - Number(a.changed) || a.field.localeCompare(b.field));
  return rows;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
}

function AuditPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  const diffRows = useMemo(
    () => (selected ? diffFields(selected.old_value, selected.new_value) : []),
    [selected],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Audit Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Most recent 200 events across the platform.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["audit_logs"] })}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="rounded-[var(--radius)] border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                When
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Entity
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tenant
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Detail
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !error && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                    <ScrollText className="h-8 w-8 opacity-60" />
                    <p className="text-sm">No audit events yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/30">
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={actionVariant(row.action)}>
                    {row.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="font-medium">{row.entity_type}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {row.entity_id?.slice(0, 8)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.tenant_id?.slice(0, 8) ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(row)}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selected && (
                <Badge variant="outline" className={actionVariant(selected.action)}>
                  {selected.action}
                </Badge>
              )}
              <span>{selected?.entity_type ?? "Event"}</span>
            </SheetTitle>
            <SheetDescription>
              {selected && new Date(selected.created_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Meta label="Entity ID" value={selected.entity_id ?? "—"} mono />
                <Meta label="Tenant ID" value={selected.tenant_id ?? "—"} mono />
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Field changes
                </div>
                <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-1/4 text-xs uppercase tracking-wider">
                          Field
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">
                          Before
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">
                          After
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diffRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                            No structured fields recorded.
                          </TableCell>
                        </TableRow>
                      )}
                      {diffRows.map((r) => (
                        <TableRow
                          key={r.field}
                          className={cn(r.changed && "bg-warning/5")}
                        >
                          <TableCell className="font-mono text-xs">
                            {r.field}
                            {r.changed && (
                              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                            {formatValue(r.before)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-pre-wrap break-words font-mono text-xs",
                              r.changed ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {formatValue(r.after)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>
        {value}
      </div>
    </div>
  );
}
