import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { pendingApprovalsCount } from "@/lib/approvals.functions";
import { listPipeline, type PipelineRow } from "@/lib/pipeline.functions";
import { usePersona } from "@/hooks/use-marketplace";
import { cn } from "@/lib/utils";

/**
 * Shared sidebar count badge (Admin › Approvals, Marketplace › Pipeline).
 * Expanded rows: pill pushed to the row's end, exactly like Admin's Approvals.
 * Collapsed icon rail: same colours as a small pill pinned to the icon.
 */
function CountPill({ count, collapsed }: { count: number; collapsed?: boolean }) {
  const label = count > 99 ? "99+" : String(count);
  if (collapsed) {
    return (
      <span
        title={`${count}`}
        className={cn(
          "absolute -right-0.5 top-0 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent px-1",
          "text-[9px] font-bold leading-none text-accent-foreground",
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
      {label}
    </span>
  );
}

/** Admin › Approvals — pending listings, buyer verifications and paid reports. */
export function ApprovalsBadge() {
  const fn = useServerFn(pendingApprovalsCount);
  const { data } = useQuery({ queryKey: ["approvals", "count"], queryFn: () => fn(), staleTime: 60_000 });
  if (!data) return null;
  return <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{data}</span>;
}

/** Marketplace › Pipeline — Pending approval count + Tracking count on My Pipeline. */
export function PipelineCountBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { persona } = usePersona();
  const fn = useServerFn(listPipeline);
  const { data } = useQuery({ queryKey: ["pipeline", persona], queryFn: () => fn({ data: { as: persona } }) });
  const rows: PipelineRow[] = data ?? [];
  // Same filters as the My Pipeline page tabs, so the badge matches the sum shown there.
  const n =
    rows.filter((p) => !p.ndaApprovedAt || (!!p.loiSentAt && !p.loiAcceptedAt)).length +
    rows.filter((p) => !!p.ndaApprovedAt).length;
  if (!n) return null;
  return <CountPill count={n} collapsed={collapsed} />;
}
