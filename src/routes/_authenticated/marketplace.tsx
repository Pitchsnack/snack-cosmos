import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { usePersona, lastAdminPath } from "@/hooks/use-marketplace";
import { PersonaBadge, useUserIdentity } from "@/components/marketplace/marketplace-frame";
import { ViewToggle } from "@/components/shared/view-toggle";
import { usePersistentView } from "@/hooks/use-persistent-view";
import {
  MarketplaceGridCard,
  MarketplaceSplitCard,
  type MarketplaceListing,
} from "@/components/marketplace/marketplace-cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — PitchSnack" },
      { name: "description", content: "Buy or sell businesses on the PitchSnack marketplace." },
      { property: "og:title", content: "Marketplace — PitchSnack" },
      { property: "og:description", content: "Buy or sell businesses on the PitchSnack marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplacePage,
});

const COPY = {
  buyer: "Find and acquire businesses — for private equity, family business / office and corporate buyers.",
  seller: "Sell your business to verified buyers — list it, share it under NDA, and follow every offer.",
};

// Real listings only — none exist yet, so the directory starts empty.
const LISTINGS: Record<"sme" | "funds", MarketplaceListing[]> = { sme: [], funds: [] };

function MarketplacePage() {
  const { persona, setPersona } = usePersona();
  const { org } = useUserIdentity();
  const navigate = useNavigate();
  const other = persona === "buyer" ? "seller" : "buyer";
  const [tab, setTab] = useState<"sme" | "funds">("sme");
  const { view, persist } = usePersistentView("ps-marketplace-view", undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const items = LISTINGS[tab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">Workspace · {persona.toUpperCase()}</p>
      </div>
      <div className="rounded-xl border border-[#f3bd62] bg-[#fef5e4] p-6 dark:bg-[#f6a823]/10">
        <h2 className="font-display text-lg font-bold text-foreground">
          {persona === "buyer" ? "Buyer Marketplace" : "Seller Marketplace"}
        </h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
          {org} <PersonaBadge persona={persona} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{COPY[persona]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: lastAdminPath() as "/dashboard" })}
            className="h-9 rounded-lg bg-[#f6a823] px-4 text-sm font-semibold text-[#0e162f] hover:bg-[#e99b16]"
          >
            Open the Admin menu
          </button>
          <button
            type="button"
            onClick={() => setPersona(other)}
            className="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold capitalize text-foreground hover:bg-muted"
          >
            Switch to {other}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex h-9 items-center rounded-md border border-input bg-background p-0.5">
          {(["sme", "funds"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setSelected(null); }}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "sme" ? "SME Takeover" : "Investment funds"}
            </button>
          ))}
        </div>
        <ViewToggle value={view} onChange={persist} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center text-sm text-muted-foreground shadow-card">
          <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>No {tab === "sme" ? "businesses" : "funds"} listed yet.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => <MarketplaceGridCard key={l.id} l={l} />)}
        </div>
      ) : view === "split" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,26rem)_1fr]">
          <div className="h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto pr-1">
            {items.map((l) => (
              <MarketplaceSplitCard key={l.id} l={l} selected={selected === l.id} onSelect={() => setSelected(l.id)} />
            ))}
          </div>
          <div className="hidden min-w-0 self-start rounded-lg border border-border bg-card p-6 shadow-sm lg:sticky lg:top-4 lg:block">
            {selected ? (
              <MarketplaceGridCard l={items.find((i) => i.id === selected)!} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a listing to preview it.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((l) => <MarketplaceSplitCard key={l.id} l={l} />)}
        </div>
      )}
    </div>
  );
}
