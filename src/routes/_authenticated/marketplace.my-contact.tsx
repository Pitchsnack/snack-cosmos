import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/marketplace/my-contact")({
  head: () => ({
    meta: [
      { title: "My contact — PitchSnack" },
      { name: "description", content: "Manage your contacts in the PitchSnack marketplace." },
      { property: "og:title", content: "My contact — PitchSnack" },
      { property: "og:description", content: "Manage your contacts in the PitchSnack marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyContactPage,
});

function MyContactPage() {
  return null;
}
