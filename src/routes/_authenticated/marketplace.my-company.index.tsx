import { createFileRoute } from "@tanstack/react-router";
import { BuyerMyCompany } from "@/components/my-business/buyer-my-company";
import { AdvisorMyCompany } from "@/components/advisor/advisor-my-company";
import { usePersona } from "@/hooks/use-marketplace";
import { ProfileEditPopup } from "@/components/my-business/profile-edit-popup";

export const Route = createFileRoute("/_authenticated/marketplace/my-company/")({
  validateSearch: (s: Record<string, unknown>): { open?: string; edit?: "profile"; section?: string; tab?:string; firm?: string; from?: "public" | "private"; add?: "1"; new?: "1" } => ({
    ...(typeof s.tab === "string" ? {tab:s.tab} : {}),
    ...(typeof s.open === "string" ? { open: s.open } : {}),
    ...(s.edit === "profile" ? { edit: "profile" as const } : {}),
    ...(typeof s.section === "string" && /^[a-z-]{2,30}$/.test(s.section) ? { section: s.section } : {}),
    ...(typeof s.firm === "string" ? { firm: s.firm } : {}),
    ...(s.from === "public" || s.from === "private" ? { from: s.from } : {}),
    ...(s.add ? { add: "1" as const } : {}),
    ...(s.new ? { new: "1" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "My Company — PitchSnack Marketplace" },
      { name: "description", content: "Manage your company profile, advisor services and investor information on PitchSnack." },
      { property: "og:title", content: "My Company — PitchSnack Marketplace" },
      { property: "og:description", content: "Manage your company profile, advisor services and investor information on PitchSnack." },
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
