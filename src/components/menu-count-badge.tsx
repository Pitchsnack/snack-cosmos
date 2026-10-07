import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { messagesBadgeCount } from "@/lib/messages.functions";
import { useServerFn } from "@tanstack/react-start";
import { pendingApprovalsCount } from "@/lib/approvals.functions";
import { pipelineBadgeCount } from "@/lib/pipeline.functions";
import { advisorPipelineCount } from "@/lib/advisor-pipeline.functions";
import { usePersona } from "@/hooks/use-marketplace";
import { cn } from "@/lib/utils";
import { useBump } from "@/hooks/use-bump";

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
        data-mkt-badge
        data-rail
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
    <span data-mkt-badge className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
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
  const fn = useServerFn(pipelineBadgeCount);
  // Own light count query; cached 60s, refreshed on focus and whenever ["pipeline"] is invalidated.
  const { data: n } = useQuery({ queryKey: ["pipeline", "count", persona], queryFn: () => fn({ data: { as: persona } }), staleTime: 60_000, refetchOnWindowFocus: true });
  if (!n) return null;
  return <CountPill count={n} collapsed={collapsed} />;
}

/** Advisor › My Pipeline — invitations plus deals across every client. */
export function AdvisorPipelineCountBadge({ collapsed = false }: { collapsed?: boolean }) {
  const fn = useServerFn(advisorPipelineCount);
  const { data: n } = useQuery({ queryKey: ["pipeline", "advisor-count"], queryFn: () => fn(), staleTime: 60_000, refetchOnWindowFocus: true });
  if (!n) return null;
  return <CountPill count={n} collapsed={collapsed} />;
}

/** Marketplace › Messages — total unread messages; refreshed every few seconds. */
export function MessagesCountBadge({ collapsed = false }: { collapsed?: boolean }) {
  const { persona } = usePersona();
  const fn = useServerFn(messagesBadgeCount);
  const active = useRouterState({ select: (s) => s.location.pathname === "/marketplace/messages" });
  const { data } = useQuery({ queryKey: ["messages", "count", persona], queryFn: () => fn({ data: { as: persona } }), staleTime: 60_000, refetchOnWindowFocus: true, refetchInterval: 2500, refetchIntervalInBackground: true });
  const n = data ?? 0;
  const bump = useBump(n);
  if (!n) return null;
  const label = n > 9 ? "9+" : String(n);
  const tone = active ? cn("bg-white", persona === "seller" ? "text-[#0E162F]" : "text-[#4338CA]") : "bg-[#F6A823] text-[#0E162F]";
  if (collapsed) {
    return (
      <span key={bump} data-mkt-badge data-rail className={cn("absolute -right-0.5 top-0 grid h-3.5 min-w-3.5 place-items-center rounded-full px-1 text-[9px] font-bold leading-none", bump && "mkt-bump", tone)}>
        {label}
      </span>
    );
  }
  return <span key={bump} data-mkt-badge className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold", bump && "mkt-bump", tone)}>{label}</span>;
}
