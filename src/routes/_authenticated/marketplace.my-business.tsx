import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/marketplace/my-business")({
  head: () => ({
    meta: [
      { title: "My business — PitchSnack" },
      { name: "description", content: "Manage your business in the PitchSnack marketplace." },
      { property: "og:title", content: "My business — PitchSnack" },
      { property: "og:description", content: "Manage your business in the PitchSnack marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyBusinessPage,
});

function MyBusinessPage() {
  return null;
}
