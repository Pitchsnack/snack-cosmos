import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "@/components/messages/messages-page";

export const Route = createFileRoute("/_authenticated/marketplace/messages")({
  head: () => ({
    meta: [
      { title: "Messages — PitchSnack" },
      { name: "description", content: "Messages with buyers, sellers, advisors and PitchSnack Help, one conversation per approved NDA." },
      { property: "og:title", content: "Messages — PitchSnack" },
      { property: "og:description", content: "Messages with buyers, sellers, advisors and PitchSnack Help, one conversation per approved NDA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});
