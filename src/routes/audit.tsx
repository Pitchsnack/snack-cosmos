import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { ScrollText } from "lucide-react";

interface AuditRow {
  id: string;
  tenant_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Logs — SnackPortal2 Control" },
      { name: "description", content: "Platform-wide audit trail of tenant changes." },
    ],
  }),
  component: AuditPage,
});

function actionVariant(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    case "UPDATE":
      return "bg-primary/10 text-primary border-primary/30";
    case "DELETE":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AuditPage() {
  const { data, isLoading, error } = useQuery({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recent 200 events across the platform.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Change</TableHead>
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
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={actionVariant(row.action)}>
                    {row.action}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.entity_type}
                  <span className="ml-2 text-muted-foreground">
                    {row.entity_id?.slice(0, 8)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.tenant_id?.slice(0, 8) ?? "—"}
                </TableCell>
                <TableCell>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View diff
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">
{JSON.stringify({ old: row.old_value, new: row.new_value }, null, 2)}
                    </pre>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
