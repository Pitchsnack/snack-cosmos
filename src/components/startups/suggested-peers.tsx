import { useState } from "react";
import { Users, ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/components/startups/connection-action";

type PeerKind = "Startups" | "Investors" | "VC Firms" | "Partners" | "People";

interface Peer {
  id: string;
  name: string;
  subtitle: string;
  kind: PeerKind;
  match: number;
  mutual: number;
  reasons: string[];
  sponsored?: boolean;
}

const FILTERS = ["All", "Startups", "Investors", "VC Firms", "Partners", "People"] as const;

/** Illustrative recommendations — no recommendation backend contract exists yet. */
const PEERS: Peer[] = [
  {
    id: "agrifuture",
    name: "AgriFuture Capital",
    subtitle: "VC Firm",
    kind: "VC Firms",
    match: 92,
    mutual: 15,
    reasons: ["AgriTech", "VC"],
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    subtitle: "Investment Director · AgriVentures",
    kind: "People",
    match: 90,
    mutual: 8,
    reasons: ["AgriTech", "Early Stage", "Same industry"],
  },
  {
    id: "root-partners",
    name: "Root Partners",
    subtitle: "VC Firm · Active in AgriTech",
    kind: "VC Firms",
    match: 88,
    mutual: 10,
    reasons: ["AgriTech", "Seed", "Portfolio overlap"],
    sponsored: true,
  },
  {
    id: "leaflink",
    name: "LeafLink Systems",
    subtitle: "AgriTech Startup · Series A",
    kind: "Startups",
    match: 82,
    mutual: 6,
    reasons: ["IoT", "AgriTech", "Complementary"],
  },
  {
    id: "greenfield",
    name: "GreenField Advisors",
    subtitle: "Strategic Partner",
    kind: "Partners",
    match: 78,
    mutual: 5,
    reasons: ["Sustainability", "Consulting"],
  },
];

/**
 * Step 3 — optional, secondary, non-blocking peer recommendations shown only
 * after the original connection request has been sent.
 */
export function SuggestedPeers() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [requested, setRequested] = useState<string[]>([]);
  const rows = filter === "All" ? PEERS : PEERS.filter((p) => p.kind === filter);

  return (
    <section className="rounded-xl border border-border/50 bg-muted/20 p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">Suggested peers (optional)</h3>
            <p className="text-xs text-muted-foreground">
              Optional recommendations based on industry, stage, interests, and mutual network.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Optional
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="mt-3 divide-y divide-border/60">
        {rows.length === 0 && (
          <li className="py-4 text-xs text-muted-foreground">No suggestions in this category.</li>
        )}
        {rows.map((p) => {
          const sent = requested.includes(p.id);
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted-foreground">
                {initials(p.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.subtitle}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.reasons.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {p.match}% Match
                </div>
                <div className="text-muted-foreground">{p.mutual} mutual connections</div>
              </div>
              {p.sponsored && (
                <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Sponsored
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={sent}
                onClick={() => setRequested((prev) => [...prev, p.id])}
                className="h-7 rounded-lg px-3 text-xs disabled:opacity-100"
              >
                {sent ? (
                  "Requested"
                ) : (
                  <>
                    <Link2 className="mr-1 h-3 w-3" /> Connect
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Search all connections <ArrowRight className="h-3 w-3" />
      </button>
    </section>
  );
}
