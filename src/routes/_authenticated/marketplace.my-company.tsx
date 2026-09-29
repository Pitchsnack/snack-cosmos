import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { BuyerMyCompany } from "@/components/my-business/buyer-my-company";

export const Route = createFileRoute("/_authenticated/marketplace/my-company")({
  head: () => ({
    meta: [
      { title: "My Company (investor profile) — PitchSnack" },
      { name: "description", content: "Manage your investor profile: the public seller preview and the private details shared after NDA." },
      { property: "og:title", content: "My Company (investor profile) — PitchSnack" },
      { property: "og:description", content: "Your investor profile on the PitchSnack Marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> My workspace</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Company</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your investor profile. Sellers see the public view in Browse investors; the private view is shared when a seller approves your NDA.</p>
      </div>
      <BuyerMyCompany />
    </div>
  );
}
