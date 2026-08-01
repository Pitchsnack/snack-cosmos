import { Check, Info, Share2, MessageSquare, Link2, Lightbulb } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptConnection,
  requestConnection,
  type ConnectionState,
} from "@/lib/connections/connection-state";
import { useConnectionState } from "@/hooks/use-connection-state";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Primary relationship action. Exactly one of Connect / Requested / Share is
 * shown for a given startup — never Connect and Share together.
 */
export function ConnectionAction({
  startupRef,
  size = "sm",
  className,
}: {
  startupRef: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const state = useConnectionState(startupRef);

  if (state === "requested") {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        aria-label="Connection requested"
        className={cn(
          "gap-1.5 rounded-full border-primary/40 text-primary disabled:opacity-100",
          className,
        )}
      >
        <Info className="h-3.5 w-3.5" /> Requested
      </Button>
    );
  }

  if (state === "connected") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button variant="outline" size={size} className="gap-1.5 rounded-full">
          <MessageSquare className="h-3.5 w-3.5" /> Message
        </Button>
        <Button
          size={size}
          className="gap-1.5 rounded-full bg-[hsl(263_70%_42%)] text-white hover:bg-[hsl(263_70%_36%)]"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
      </div>
    );
  }

  return (
    <Button
      size={size}
      onClick={() => requestConnection(startupRef)}
      className={cn("gap-1.5 rounded-full", className)}
    >
      <Link2 className="h-3.5 w-3.5" /> Connect
    </Button>
  );
}

/** Step 2 / Step 4 state cards rendered under the startup header. */
export function ConnectionStateCard({
  startupRef,
  counterpartName,
  counterpartRole,
}: {
  startupRef: string;
  counterpartName: string;
  counterpartRole?: string | null;
}) {
  const state: ConnectionState = useConnectionState(startupRef);
  if (state === "none") return null;

  if (state === "requested") {
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
        </div>
        <h3 className="mt-3 text-base font-semibold">Connection request sent!</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {counterpartName} has been notified.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary">
          <Info className="h-3.5 w-3.5" /> Requested
        </span>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-4">
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link to="/connections">View My Connections</Link>
          </Button>
          {/* Frontend-only demo of the recipient accepting the request. */}
          <Button size="sm" className="rounded-lg" onClick={() => acceptConnection(startupRef)}>
            Done
          </Button>
        </div>

        <p className="mt-4 inline-flex items-start gap-2 text-left text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Once {counterpartName} accepts your connection, this action will become “Share”.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            You’re now connected!
          </h3>
          <p className="text-sm text-muted-foreground">
            You can now share information with {counterpartName}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initials(counterpartName)}
          </div>
          <div>
            <div className="text-sm font-semibold">{counterpartName}</div>
            {counterpartRole && (
              <div className="text-xs text-muted-foreground">{counterpartRole}</div>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Connected
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="flex-1 gap-2">
          <MessageSquare className="h-4 w-4" /> Message
        </Button>
        <Button className="flex-1 gap-2 bg-[hsl(263_70%_42%)] text-white hover:bg-[hsl(263_70%_36%)]">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>
    </section>
  );
}
