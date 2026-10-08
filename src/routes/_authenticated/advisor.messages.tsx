import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "@/components/messages/messages-page";

export const Route = createFileRoute("/_authenticated/advisor/messages")({
  head: () => ({
    meta: [
      { title: "Advisor Messages — PitchSnack" },
      { name: "description", content: "Messages with your clients and the other side on every deal you joined, plus PitchSnack Help." },
      { property: "og:title", content: "Advisor Messages — PitchSnack" },
      { property: "og:description", content: "Messages with your clients and the other side on every deal you joined, plus PitchSnack Help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});
