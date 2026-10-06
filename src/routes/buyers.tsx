import { createFileRoute } from "@tanstack/react-router";
import { BuyersPage } from "@/components/public-site/buyers-page";

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
  component: BuyersPage,
});
