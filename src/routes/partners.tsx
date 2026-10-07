import { createFileRoute } from "@tanstack/react-router";
import { PartnersPage } from "@/components/public-site/partners-page";

const DESC = "For advisers and professional firms in Thailand: one verified firm profile that sellers and buyers find, contact directly, and bring into their deals.";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "PitchSnack · For partners" },
      { name: "description", content: DESC },
      { property: "og:title", content: "PitchSnack · For partners" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://pitchsnack.com/partners" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://pitchsnack.com/partners" }],
  }),
  component: PartnersPage,
});
