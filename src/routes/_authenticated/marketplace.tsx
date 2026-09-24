import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { usePersona, lastAdminPath } from "@/hooks/use-marketplace";
import { PersonaBadge, useUserIdentity } from "@/components/marketplace/marketplace-frame";

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

function MarketplacePage() {
  const { persona, setPersona } = usePersona();
  const { org } = useUserIdentity();
  const navigate = useNavigate();
  const other = persona === "buyer" ? "seller" : "buyer";
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
    </div>
  );
}
