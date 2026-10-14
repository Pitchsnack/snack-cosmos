import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BrowseAdvisorsPage } from "@/components/advisor-browse/browse-advisors";
import { usePersona } from "@/hooks/use-marketplace";

export const Route = createFileRoute("/_authenticated/marketplace/advisors")({
  validateSearch: (s: Record<string, unknown>): { firm?: string; enquire?: string } => ({
    ...(typeof s.firm === "string" ? { firm: s.firm } : {}),
    ...(s.enquire != null ? { enquire: String(s.enquire) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Browse advisors — PitchSnack" },
      { name: "description", content: "Find M&A advisers, valuers, lawyers and accountants on PitchSnack, compare their services, fees and reviews, and send a free enquiry." },
      { property: "og:title", content: "Browse advisors — PitchSnack" },
      { property: "og:description", content: "Find M&A advisers, valuers, lawyers and accountants on PitchSnack, compare their services, fees and reviews, and send a free enquiry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvisorsRoute,
});

function AdvisorsRoute() {
  const { persona } = usePersona();
  const { firm, enquire } = Route.useSearch();
  if (persona === "seller" || persona === "buyer") return <BrowseAdvisorsPage key={persona} side={persona} firmParam={firm} enquire={enquire === "1"} />;
  return <Navigate to="/marketplace/browse" replace />;
}
