import { createFileRoute } from "@tanstack/react-router";
import { SellersPage } from "@/components/public-site/sellers-page";
import { getHomeHeroImages } from "@/lib/home-hero.functions";

const TITLE = "PitchSnack · For sellers";
const DESC = "Sell your business privately on PitchSnack. Anonymous profile, every buyer verified and under NDA, no exclusivity, withdraw at any time.";

function SellersRoute() {
  const imgs = Route.useLoaderData();
  return <SellersPage initial={imgs} />;
}

export const Route = createFileRoute("/sellers")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Fetch on first page load only; on in-app clicks the page fetches its own pictures so the switch is instant.
  loader: () => (typeof window === "undefined" ? getHomeHeroImages().catch(() => ({ seller: null, investor: null })) : undefined),
  component: SellersRoute,
});
