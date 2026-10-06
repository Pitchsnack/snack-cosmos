import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/public-site/public-home";
import { SOON } from "@/components/public-site/home-copy";

const page = SOON["/plans"]!;

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: `${page.title.en} — PitchSnack` },
      { name: "description", content: `${page.title.en} on PitchSnack, the confidential marketplace for Thai businesses changing hands. Coming soon.` },
      { property: "og:title", content: `${page.title.en} — PitchSnack` },
      { property: "og:description", content: `${page.title.en} on PitchSnack. This page is coming soon.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon title={page.title} nav={page.nav} />,
});
