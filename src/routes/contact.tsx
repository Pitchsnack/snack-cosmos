import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/public-site/contact-page";

const D = "Send the PitchSnack team an enquiry or email support@pitchsnack.com. We reply within 48 hours.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "PitchSnack · Contact" },
      { name: "description", content: D },
      { property: "og:title", content: "Contact the PitchSnack team" },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});
