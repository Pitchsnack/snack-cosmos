import { createFileRoute } from "@tanstack/react-router";
import { BusinessesWantedPage } from "@/components/businesses-wanted/bw-page";

export const Route = createFileRoute("/_authenticated/marketplace/businesses-wanted")({
  validateSearch: (s: Record<string, unknown>): { bo?: string } => (typeof s.bo === "string" && /^BO-\d+$/i.test(s.bo) ? { bo: s.bo } : {}),
  head: () => ({
    meta: [
      { title: "Businesses Wanted by Buyers — PitchSnack" },
      { name: "description", content: "Buy orders from qualified buyers: the industry, place, size and deal they want. Buyers' names stay private." },
      { property: "og:title", content: "Businesses Wanted by Buyers — PitchSnack" },
      { property: "og:description", content: "Buy orders from qualified buyers: the industry, place, size and deal they want." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { bo } = Route.useSearch();
  return <BusinessesWantedPage bo={bo} />;
}
