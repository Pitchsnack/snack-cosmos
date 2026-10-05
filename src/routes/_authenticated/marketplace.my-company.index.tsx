import { createFileRoute } from "@tanstack/react-router";
import { BuyerMyCompany } from "@/components/my-business/buyer-my-company";
import { AdvisorMyCompany } from "@/components/advisor/advisor-my-company";
import { usePersona } from "@/hooks/use-marketplace";

export const Route = createFileRoute("/_authenticated/marketplace/my-company/")({
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
  const { persona } = usePersona();
  return persona === "advisor" ? <AdvisorMyCompany /> : <BuyerMyCompany />;
}
