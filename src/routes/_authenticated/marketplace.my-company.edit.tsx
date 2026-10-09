import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSessionContext } from "@/hooks/use-session-context";
import { useMyAdvisorFirms } from "@/components/advisor/advisor-my-company";
import { BuyerInvestorEdit } from "@/components/my-business/buyer-investor-edit";
import { AdvisorFirmEdit } from "@/components/advisor/advisor-firm-edit";
import { usePersona } from "@/hooks/use-marketplace";
import type { EditSection } from "@/lib/advisor-firm";

const SECTIONS = ["firm", "services", "work", "company", "team", "credentials", "documents"];
type Search = { firm?: string; new?: string; section?: string; add?: "1" };

export const Route = createFileRoute("/_authenticated/marketplace/my-company/edit")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.firm === "string" ? { firm: s.firm } : {}),
    ...(s.new ? { new: "1" } : {}),
    ...(typeof s.section === "string" && /^[a-z-]{2,30}$/.test(s.section) ? { section: s.section } : {}),
    ...(s.add ? { add: "1" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Edit investor profile — PitchSnack" },
      { name: "description", content: "Edit your firm's investor record: the same details Admin sees in Investors Directory." },
      { property: "og:title", content: "Edit investor profile — PitchSnack" },
      { property: "og:description", content: "Update your firm's investor profile on PitchSnack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditPage,
});

function EditPage() {
  const { persona } = usePersona();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: session } = useSessionContext();
  const role = session?.user?.accountRole ?? null;
  const oneCompany = role === "seller" || role === "buyer" || role === "advisor";
  const firms = useMyAdvisorFirms();
  const blockNew = persona === "advisor" && !!search.new && oneCompany && (firms.data?.length ?? 0) > 0;
  useEffect(() => {
    if (blockNew) { toast("Your account has one company. Ask PitchSnack if you need another."); void navigate({ to: "/marketplace/my-company", replace: true }); }
  }, [blockNew, navigate]);
  if (blockNew) return null;
  if (persona === "advisor") {
    const sec = search.section && SECTIONS.includes(search.section) ? (search.section as EditSection) : undefined;
    return <AdvisorFirmEdit firmId={search.firm ?? null} section={sec} />;
  }
  return <BuyerInvestorEdit section={search.section} add={!!search.add} />;
}
