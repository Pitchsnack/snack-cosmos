import { createFileRoute } from "@tanstack/react-router";
import { BuyerMyCompany } from "@/components/my-business/buyer-my-company";
import { AdvisorMyCompany } from "@/components/advisor/advisor-my-company";
import { usePersona } from "@/hooks/use-marketplace";
import { ProfileEditPopup } from "@/components/my-business/profile-edit-popup";

export const Route = createFileRoute("/_authenticated/marketplace/my-company/")({
  validateSearch: (s: Record<string, unknown>): { open?: string; edit?: "profile"; section?: string; firm?: string; from?: "public" | "private"; add?: "1" } => ({
    ...(typeof s.open === "string" ? { open: s.open } : {}),
    ...(s.edit === "profile" ? { edit: "profile" as const } : {}),
    ...(typeof s.section === "string" && /^[a-z-]{2,30}$/.test(s.section) ? { section: s.section } : {}),
    ...(typeof s.firm === "string" ? { firm: s.firm } : {}),
    ...(s.from === "public" || s.from === "private" ? { from: s.from } : {}),
    ...(s.add ? { add: "1" as const } : {}),
  }),
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
  const { open } = Route.useSearch();
  return (
    <>
      {persona === "advisor" ? <AdvisorMyCompany initialOpen={open} /> : <BuyerMyCompany />}
      <ProfileEditPopup advisor={persona === "advisor"} />
    </>
  );
}
