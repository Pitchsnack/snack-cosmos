import { createFileRoute } from "@tanstack/react-router";
import { MyAdvertisementsPage } from "@/components/businesses-wanted/bw-my-ads";

export const Route = createFileRoute("/_authenticated/marketplace/advertisement")({
  head: () => ({
    meta: [
      { title: "My advertisements — PitchSnack" },
      { name: "description", content: "Post an advertisement for a business you want to buy. Sellers apply with their listing, and you review them." },
      { property: "og:title", content: "My advertisements — PitchSnack" },
      { property: "og:description", content: "Post an advertisement for a business you want to buy on PitchSnack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyAdvertisementsPage,
});
