import { createFileRoute } from "@tanstack/react-router";
import { PublicHome } from "@/components/public-site/public-home";

const D = "PitchSnack is a neutral Thai marketplace where verified SME owners meet corporate and investor buyers, with privacy at every stage.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchSnack" },
      { name: "description", content: D },
      { property: "og:title", content: "PitchSnack — the confidential marketplace for Thai businesses" },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicHome,
});
