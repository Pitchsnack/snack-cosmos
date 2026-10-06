import { createFileRoute } from "@tanstack/react-router";
import { BuyersPage } from "@/components/public-site/buyers-page";
import { getHomeHeroImages } from "@/lib/home-hero.functions";

function BuyersRoute() {
  const imgs = Route.useLoaderData();
  return <BuyersPage initial={imgs} />;
}

const DESC = "Find a business to buy in Thailand. Browse anonymous teasers from verified sellers and see the full listing after one standard NDA.";

export const Route = createFileRoute("/buyers")({
  head: () => ({
    meta: [
      { title: "PitchSnack · For buyers" },
      { name: "description", content: DESC },
      { property: "og:title", content: "PitchSnack · For buyers" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => getHomeHeroImages().catch(() => ({ seller: null, investor: null })),
  component: BuyersRoute,
});
