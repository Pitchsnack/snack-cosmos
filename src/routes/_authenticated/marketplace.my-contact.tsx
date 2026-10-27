import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceContactsPage } from "@/components/contacts/marketplace-contacts-page";
export const Route = createFileRoute("/_authenticated/marketplace/my-contact")({
  head: () => ({
    meta: [
      { title: "Contacts — PitchSnack" },
      { name: "description", content: "Everyone you are working with on PitchSnack, with their contact details in one place." },
      { property: "og:title", content: "Contacts — PitchSnack" },
      { property: "og:description", content: "Everyone you are working with on PitchSnack, with their contact details in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplaceContactsPage,
});

